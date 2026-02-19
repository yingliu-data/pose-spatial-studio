"""TCPFormer — Lean inference-only model.

Consolidated from https://github.com/AsukaCamellia/TCPFormer (AAAI 2025).
Only the modules required for forward-pass inference are kept:
  Attention, CrossAttention, MLP, Sum_Attention, MIBlock,
  TransBlock, DSTFormerBlock, MemoryInducedBlock, MemoryInducedTransformer.

Fixes applied vs. upstream:
  - MemoryInducedBlock.layer_scale converted from plain list to nn.ParameterList
    (original never registers these params; they stay at init value 1e-5 regardless).
  - Removed hardcoded ``os.environ['CUDA_VISIBLE_DEVICES']`` and ``.to('cuda')``.
"""

from collections import OrderedDict

import torch
from torch import nn
from timm.models.layers import DropPath


# ---------------------------------------------------------------------------
# MLP
# ---------------------------------------------------------------------------
class MLP(nn.Module):
    def __init__(self, in_features, hidden_features=None, out_features=None,
                 act_layer=nn.GELU, drop=0.):
        super().__init__()
        out_features = out_features or in_features
        hidden_features = hidden_features or in_features
        self.fc1 = nn.Linear(in_features, hidden_features)
        self.act = act_layer()
        self.fc2 = nn.Linear(hidden_features, out_features)
        self.drop = nn.Dropout(drop)

    def forward(self, x):
        x = self.drop(self.act(self.fc1(x)))
        x = self.drop(self.fc2(x))
        return x


# ---------------------------------------------------------------------------
# Self-Attention (spatial / temporal)
# ---------------------------------------------------------------------------
class Attention(nn.Module):
    def __init__(self, dim_in, dim_out, num_heads=8, qkv_bias=False,
                 qk_scale=None, attn_drop=0., proj_drop=0., mode='spatial',
                 vis='no'):
        super().__init__()
        self.num_heads = num_heads
        head_dim = dim_in // num_heads
        self.scale = qk_scale or head_dim ** -0.5
        self.qkv = nn.Linear(dim_in, dim_in * 3, bias=qkv_bias)
        self.attn_drop = nn.Dropout(attn_drop)
        self.proj = nn.Linear(dim_in, dim_out)
        self.proj_drop = nn.Dropout(proj_drop)
        self.mode = mode

    def forward(self, x):
        B, T, J, C = x.shape
        qkv = (self.qkv(x)
               .reshape(B, T, J, 3, self.num_heads, C // self.num_heads)
               .permute(3, 0, 4, 1, 2, 5))  # (3, B, H, T, J, Cd)
        q, k, v = qkv[0], qkv[1], qkv[2]
        if self.mode == 'spatial':
            x = self._spatial(q, k, v)
        elif self.mode == 'temporal':
            x = self._temporal(q, k, v)
        else:
            raise ValueError(self.mode)
        return self.proj_drop(self.proj(x))

    def _spatial(self, q, k, v):
        B, H, T, J, C = q.shape
        attn = self.attn_drop((q @ k.transpose(-2, -1) * self.scale).softmax(-1))
        return (attn @ v).permute(0, 2, 3, 1, 4).reshape(B, T, J, C * H)

    def _temporal(self, q, k, v):
        B, H, T, J, C = q.shape
        qt, kt, vt = (t.transpose(2, 3) for t in (q, k, v))  # (B,H,J,T,C)
        attn = self.attn_drop((qt @ kt.transpose(-2, -1) * self.scale).softmax(-1))
        return (attn @ vt).permute(0, 3, 2, 1, 4).reshape(B, T, J, C * H)


# ---------------------------------------------------------------------------
# Cross-Attention
# ---------------------------------------------------------------------------
class CrossAttention(nn.Module):
    def __init__(self, dim_in, dim_out, num_heads=8, qkv_bias=False,
                 qkv_scale=None, attn_drop=0., proj_drop=0., mode='temporal',
                 back_att=None):
        super().__init__()
        self.num_heads = num_heads
        head_dim = dim_in // num_heads
        self.scale = qkv_scale or head_dim ** -0.5
        self.wq = nn.Linear(dim_in, dim_in, bias=qkv_bias)
        self.wk = nn.Linear(dim_in, dim_in, bias=qkv_bias)
        self.wv = nn.Linear(dim_in, dim_in, bias=qkv_bias)
        self.attn_drop = nn.Dropout(attn_drop)
        self.proj = nn.Linear(dim_in, dim_out)
        self.proj_drop = nn.Dropout(proj_drop)
        self.back_att = back_att

    def forward(self, q, kv):
        b, t, j, d = q.shape
        t_sup = kv.shape[1]
        H = self.num_heads
        Cd = d // H
        q = self.wq(q).reshape(b, t, j, H, Cd).permute(0, 3, 2, 1, 4)
        k = self.wk(kv).reshape(b, t_sup, j, H, Cd).permute(0, 3, 2, 1, 4)
        v = self.wv(kv).reshape(b, t_sup, j, H, Cd).permute(0, 3, 2, 1, 4)
        attn = self.attn_drop((q @ k.transpose(-2, -1) * self.scale).softmax(-1))
        out = (attn @ v).permute(0, 3, 2, 1, 4).reshape(b, t, j, d)
        out = self.proj_drop(self.proj(out))
        if self.back_att:
            return attn, out
        return out


# ---------------------------------------------------------------------------
# Sum_Attention (self-attention + attention-map fusion)
# ---------------------------------------------------------------------------
class Sum_Attention(nn.Module):
    def __init__(self, dim_in, dim_out, num_heads=8, qkv_bias=False,
                 qk_scale=None, attn_drop=0., proj_drop=0., mode='spatial'):
        super().__init__()
        self.num_heads = num_heads
        head_dim = dim_in // num_heads
        self.scale = qk_scale or head_dim ** -0.5
        self.qkv = nn.Linear(dim_in, dim_in * 3, bias=qkv_bias)
        self.attn_drop = nn.Dropout(attn_drop)
        self.proj = nn.Linear(dim_in, dim_out)
        self.proj_drop = nn.Dropout(proj_drop)

    def forward(self, x, att_map, weight):
        B, T, J, C = x.shape
        qkv = (self.qkv(x)
               .reshape(B, T, J, 3, self.num_heads, C // self.num_heads)
               .permute(3, 0, 4, 1, 2, 5))
        q, k, v = qkv[0], qkv[1], qkv[2]
        B, H, T, J, C = q.shape
        qt, kt, vt = (t.transpose(2, 3) for t in (q, k, v))
        attn = self.attn_drop((qt @ kt.transpose(-2, -1) * self.scale).softmax(-1))
        attn = self.attn_drop(weight * attn + (1 - weight) * att_map)
        x = (attn @ vt).permute(0, 3, 2, 1, 4).reshape(B, T, J, C * H)
        return self.proj_drop(self.proj(x))


# ---------------------------------------------------------------------------
# MIBlock (Memory-Induced Block) — bidirectional cross-attention + map fusion
# ---------------------------------------------------------------------------
class MIBlock(nn.Module):
    def __init__(self, dim, mlp_ratio=4., act_layer=nn.GELU, attn_drop=0.,
                 drop=0., drop_path=0., num_heads=8, qkv_bias=False,
                 qk_scale=None, use_layer_scale=True,
                 layer_scale_init_value=1e-5, mode='temporal', **_kw):
        super().__init__()
        mlp_hidden = int(dim * mlp_ratio)
        self.norm_full = nn.LayerNorm(dim)
        self.norm_center = nn.LayerNorm(dim)
        self.center_full = CrossAttention(dim, dim, num_heads, qkv_bias,
                                          qk_scale, attn_drop, drop, mode,
                                          back_att=True)
        self.full_center = CrossAttention(dim, dim, num_heads, qkv_bias,
                                          qk_scale, attn_drop, drop, mode,
                                          back_att=True)
        self.mlp_1 = MLP(dim, mlp_hidden, act_layer=act_layer, drop=drop)
        self.mlp_2 = MLP(dim, mlp_hidden, act_layer=act_layer, drop=drop)
        self.norm_1 = nn.LayerNorm(dim)
        self.norm_2 = nn.LayerNorm(dim)
        self.drop_path = DropPath(drop_path) if drop_path > 0. else nn.Identity()
        self.use_layer_scale = use_layer_scale
        if use_layer_scale:
            self.layer_scale_1 = nn.Parameter(layer_scale_init_value * torch.ones(dim))
            self.layer_scale_2 = nn.Parameter(layer_scale_init_value * torch.ones(dim))
            self.layer_scale_3 = nn.Parameter(layer_scale_init_value * torch.ones(dim))
            self.layer_scale_4 = nn.Parameter(layer_scale_init_value * torch.ones(dim))
            self.layer_scale_5 = nn.Parameter(layer_scale_init_value * torch.ones(dim))
            self.layer_scale_6 = nn.Parameter(layer_scale_init_value * torch.ones(dim))
            self.layer_scale_7 = nn.Parameter(layer_scale_init_value * torch.ones(dim))
            self.layer_scale_8 = nn.Parameter(layer_scale_init_value * torch.ones(dim))

        self.norm_sa_self = nn.LayerNorm(dim)
        self.map_sa_self = Attention(dim, dim, num_heads, qkv_bias, qk_scale,
                                     attn_drop, drop, mode)
        self.norm_mlp_self = nn.LayerNorm(dim)
        self.mlp_sa_self = MLP(dim, mlp_hidden, act_layer=act_layer, drop=drop)
        self.norm_sa_1 = nn.LayerNorm(dim)
        self.map_sum = Sum_Attention(dim, dim, num_heads, qkv_bias, qk_scale,
                                     attn_drop, drop, mode)
        self.norm_sa_2 = nn.LayerNorm(dim)
        self.mlp_sa = MLP(dim, mlp_hidden, act_layer=act_layer, drop=drop)
        self.sg = nn.Sigmoid()
        self.att_weight = nn.Parameter(torch.rand(1))

    def forward(self, x, pose_query):
        if self.use_layer_scale:
            _u = lambda s: s.unsqueeze(0).unsqueeze(0)
            _u1 = lambda s: s.unsqueeze(0).unsqueeze(1)
            attn1, o1 = self.center_full(self.norm_center(pose_query), self.norm_full(x))
            pose_query = pose_query + self.drop_path(_u(self.layer_scale_1) * o1)
            pose_query = pose_query + self.drop_path(_u(self.layer_scale_2) * self.mlp_1(self.norm_1(pose_query)))
            attn2, o2 = self.full_center(self.norm_full(x), self.norm_center(pose_query))
            x = x + self.drop_path(_u(self.layer_scale_3) * o2)
            x = x + self.drop_path(_u(self.layer_scale_4) * self.mlp_2(self.norm_2(x)))
            attn_map = attn2 @ attn1
            nw = self.sg(self.att_weight)
            x = x + self.drop_path(_u1(self.layer_scale_7) * self.map_sa_self(self.norm_sa_self(x)))
            x = x + self.drop_path(_u1(self.layer_scale_8) * self.mlp_sa_self(self.norm_mlp_self(x)))
            x = x + self.drop_path(_u1(self.layer_scale_5) * self.map_sum(self.norm_sa_1(x), attn_map, nw))
            x = x + self.drop_path(_u1(self.layer_scale_6) * self.mlp_sa(self.norm_sa_2(x)))
        return x, pose_query


# ---------------------------------------------------------------------------
# TransBlock — spatial or temporal attention block
# ---------------------------------------------------------------------------
class TransBlock(nn.Module):
    def __init__(self, dim, mlp_ratio=4., act_layer=nn.GELU, attn_drop=0.,
                 drop=0., drop_path=0., num_heads=8, qkv_bias=False,
                 qk_scale=None, use_layer_scale=True,
                 layer_scale_init_value=1e-5, mode='spatial',
                 mixer_type='attention', **_kw):
        super().__init__()
        self.norm1 = nn.LayerNorm(dim)
        self.norm2 = nn.LayerNorm(dim)
        mlp_hidden = int(dim * mlp_ratio)
        self.mixer_type = mixer_type

        if mixer_type == 'crossattention':
            self.local_attention_list = nn.ModuleList([
                Attention(dim, dim, num_heads, qkv_bias, qk_scale, attn_drop,
                          drop, mode) for _ in range(3)
            ])
            self.loacl_mlps = nn.ModuleList([
                MLP(dim, mlp_hidden, act_layer=act_layer, drop=drop) for _ in range(3)
            ])
            self.normq = nn.LayerNorm(dim)
            self.normkv = nn.LayerNorm(dim)
            self.mixer = nn.ModuleList([
                CrossAttention(dim, dim, num_heads, qkv_bias, qk_scale,
                               attn_drop, drop, mode) for _ in range(3)
            ])
            self.self_attention = Attention(dim, dim, num_heads, qkv_bias,
                                            qk_scale, attn_drop, drop, mode,
                                            vis='yes')
            self.mlps = nn.ModuleList([
                MLP(dim, mlp_hidden, act_layer=act_layer, drop=drop) for _ in range(3)
            ])
            self.sa_mlp = MLP(dim, mlp_hidden, act_layer=act_layer, drop=drop)
            self.norms = nn.ModuleList([nn.LayerNorm(dim) for _ in range(3)])
        elif mixer_type == 'attention':
            self.mixer = Attention(dim, dim, num_heads, qkv_bias, qk_scale,
                                   attn_drop, drop, mode)

        self.mlp = MLP(dim, mlp_hidden, act_layer=act_layer, drop=drop)
        self.drop_path = DropPath(drop_path) if drop_path > 0. else nn.Identity()
        self.use_layer_scale = use_layer_scale
        if use_layer_scale:
            self.layer_scale_1 = nn.Parameter(layer_scale_init_value * torch.ones(dim))
            self.layer_scale_2 = nn.Parameter(layer_scale_init_value * torch.ones(dim))

    def forward(self, x):
        if self.mixer_type == 'crossattention':
            x = self._forward_local(x)
            length = x.shape[1] // 3
            return self._forward_cross(x, length)
        _u = lambda s: s.unsqueeze(0).unsqueeze(0)
        if self.use_layer_scale:
            x = x + self.drop_path(_u(self.layer_scale_1) * self.mixer(self.norm1(x)))
            x = x + self.drop_path(_u(self.layer_scale_2) * self.mlp(self.norm2(x)))
        else:
            x = x + self.drop_path(self.mixer(self.norm1(x)))
            x = x + self.drop_path(self.mlp(self.norm2(x)))
        return x

    def _forward_cross(self, x, part_size):
        parts = [x[:, :part_size], x[:, part_size:2*part_size], x[:, 2*part_size:]]
        kvs = [
            torch.cat([parts[1], parts[2]], dim=1),
            torch.cat([parts[0], parts[2]], dim=1),
            torch.cat([parts[1], parts[2]], dim=1),
        ]
        _u = lambda s: s.unsqueeze(0).unsqueeze(0)
        for i in range(3):
            if self.use_layer_scale:
                parts[i] = parts[i] + self.drop_path(_u(self.layer_scale_1) * self.mixer[i](self.normq(parts[i]), self.normkv(kvs[i])))
                parts[i] = parts[i] + self.drop_path(_u(self.layer_scale_1) * self.mlps[i](self.norms[i](parts[i])))
            else:
                parts[i] = parts[i] + self.drop_path(self.mixer[i](self.normq(parts[i]), self.normkv(kvs[i])))
                parts[i] = parts[i] + self.drop_path(self.mlps[i](self.norms[i](parts[i])))
        out = torch.cat(parts, dim=1)
        if self.use_layer_scale:
            out = out + self.drop_path(_u(self.layer_scale_1) * self.self_attention(self.norm1(out)))
            out = out + self.drop_path(_u(self.layer_scale_2) * self.sa_mlp(self.norm2(out)))
        else:
            out = out + self.drop_path(self.self_attention(self.norm1(out)))
            out = out + self.drop_path(self.sa_mlp(self.norm2(out)))
        return out

    def _forward_local(self, x):
        parts = list(torch.chunk(x, 3, dim=1))
        _u = lambda s: s.unsqueeze(0).unsqueeze(0)
        for i in range(3):
            if self.use_layer_scale:
                parts[i] = parts[i] + self.drop_path(_u(self.layer_scale_1) * self.local_attention_list[i](self.norm1(parts[i])))
                parts[i] = parts[i] + self.drop_path(_u(self.layer_scale_2) * self.loacl_mlps[i](self.norm2(parts[i])))
            else:
                parts[i] = parts[i] + self.drop_path(self.local_attention_list[i](self.norm1(parts[i])))
                parts[i] = parts[i] + self.drop_path(self.loacl_mlps[i](self.norm2(parts[i])))
        return torch.cat(parts, dim=1)


# ---------------------------------------------------------------------------
# DSTFormerBlock — dual spatial-temporal with adaptive fusion
# ---------------------------------------------------------------------------
class DSTFormerBlock(nn.Module):
    def __init__(self, dim, mlp_ratio=4., act_layer=nn.GELU, attn_drop=0.,
                 drop=0., drop_path=0., num_heads=8, use_layer_scale=True,
                 qkv_bias=False, qk_scale=None, layer_scale_init_value=1e-5,
                 use_adaptive_fusion=True, n_frames=243, **_kw):
        super().__init__()
        kw = dict(mlp_ratio=mlp_ratio, act_layer=act_layer, attn_drop=attn_drop,
                  drop=drop, drop_path=drop_path, num_heads=num_heads,
                  qkv_bias=qkv_bias, qk_scale=qk_scale,
                  use_layer_scale=use_layer_scale,
                  layer_scale_init_value=layer_scale_init_value,
                  n_frames=n_frames)
        self.att_spatial = TransBlock(dim, mode='spatial', mixer_type='attention', **kw)
        self.att_temporal = TransBlock(dim, mode='temporal', mixer_type='attention', **kw)
        self.graph_spatial = TransBlock(dim, mode='temporal', mixer_type='attention', **kw)
        self.graph_temporal = TransBlock(dim, mode='spatial', mixer_type='attention', **kw)
        self.use_adaptive_fusion = use_adaptive_fusion
        if use_adaptive_fusion:
            self.fusion = nn.Linear(dim * 2, 2)
            self.fusion.weight.data.fill_(0)
            self.fusion.bias.data.fill_(0.5)

    def forward(self, x):
        x_attn = self.att_temporal(self.att_spatial(x))
        x_graph = self.graph_temporal(self.graph_spatial(x))
        alpha = self.fusion(torch.cat((x_attn, x_graph), dim=-1)).softmax(-1)
        return x_attn * alpha[..., 0:1] + x_graph * alpha[..., 1:2]


# ---------------------------------------------------------------------------
# MemoryInducedBlock — local temporal attention + MIBlock
# ---------------------------------------------------------------------------
class MemoryInducedBlock(nn.Module):
    def __init__(self, dim, mlp_ratio=4., act_layer=nn.GELU, attn_drop=0.,
                 drop=0., drop_path=0., num_heads=8, use_layer_scale=True,
                 qkv_bias=False, qk_scale=None, layer_scale_init_value=1e-5,
                 n_frames=243, mode='temporal', **_kw):
        super().__init__()
        mlp_hidden = int(dim * mlp_ratio)
        self.drop_path = DropPath(drop_path) if drop_path > 0. else nn.Identity()
        self.local_attention_list = nn.ModuleList([
            Attention(dim, dim, num_heads, qkv_bias, qk_scale, attn_drop,
                      drop, mode) for _ in range(3)
        ])
        self.loacl_mlps = nn.ModuleList([
            MLP(dim, mlp_hidden, act_layer=act_layer, drop=drop) for _ in range(3)
        ])
        # Fix: use nn.ParameterList instead of plain list (upstream bug).
        # These are never saved in the original checkpoint; they always stay at
        # their init value (layer_scale_init_value = 1e-5).
        self.layer_scale = nn.ParameterList([
            nn.Parameter(layer_scale_init_value * torch.ones(dim))
            for _ in range(6)
        ])
        self.local_norms = nn.ModuleList([nn.LayerNorm(dim) for _ in range(6)])
        kw = dict(mlp_ratio=mlp_ratio, act_layer=act_layer, attn_drop=attn_drop,
                  drop=drop, drop_path=drop_path, num_heads=num_heads,
                  qkv_bias=qkv_bias, qk_scale=qk_scale,
                  use_layer_scale=use_layer_scale,
                  layer_scale_init_value=layer_scale_init_value,
                  n_frames=n_frames)
        self.cross_temporal = MIBlock(dim, mode='temporal', **kw)

    def forward(self, x, pose_query):
        parts = list(torch.chunk(x, 3, dim=1))
        for i in range(3):
            _u = lambda s: s.unsqueeze(0).unsqueeze(0)
            parts[i] = parts[i] + self.drop_path(_u(self.layer_scale[i]) * self.local_attention_list[i](self.local_norms[i](parts[i])))
            parts[i] = parts[i] + self.drop_path(_u(self.layer_scale[i + 3]) * self.loacl_mlps[i](self.local_norms[i + 3](parts[i])))
        x = torch.cat(parts, dim=1)
        return self.cross_temporal(x, pose_query)


# ---------------------------------------------------------------------------
# Layer factory
# ---------------------------------------------------------------------------
def _create_layers(dim, n_layers, layer_type=None, **kw):
    Cls = MemoryInducedBlock if layer_type == 'temporal' else DSTFormerBlock
    return nn.ModuleList([Cls(dim=dim, **kw) for _ in range(n_layers)])


# ---------------------------------------------------------------------------
# MemoryInducedTransformer — top-level model
# ---------------------------------------------------------------------------
class MemoryInducedTransformer(nn.Module):
    """TCPFormer model for 2D→3D human pose lifting.

    Input:  (B, T, J, C)  — T temporal frames, J joints, C=3 (x, y, conf)
    Output: (B, T, J, 3)  — root-relative 3D coordinates
    """

    def __init__(self, n_layers=16, dim_in=3, dim_feat=128, dim_rep=512,
                 dim_out=3, mlp_ratio=4, act_layer=nn.GELU, attn_drop=0.,
                 drop=0., drop_path=0., use_layer_scale=True,
                 layer_scale_init_value=1e-5, use_adaptive_fusion=True,
                 num_heads=8, qkv_bias=False, qkv_scale=None,
                 num_joints=17, n_frames=81, **_kw):
        super().__init__()
        kw = dict(mlp_ratio=mlp_ratio, act_layer=act_layer, attn_drop=attn_drop,
                  drop=drop, drop_path=drop_path, num_heads=num_heads,
                  use_layer_scale=use_layer_scale, qkv_bias=qkv_bias,
                  qk_scale=qkv_scale,
                  layer_scale_init_value=layer_scale_init_value,
                  use_adaptive_fusion=use_adaptive_fusion, n_frames=n_frames)

        self.joints_embed = nn.Linear(dim_in, dim_feat)
        self.pos_embed = nn.Parameter(torch.zeros(1, num_joints, dim_feat))
        self.norm = nn.LayerNorm(dim_feat)

        self.layers = _create_layers(dim_feat, n_layers, **kw)
        self.temporal_layers = _create_layers(dim_feat, n_layers,
                                              layer_type='temporal', **kw)

        self.rep_logit = nn.Sequential(OrderedDict([
            ('fc', nn.Linear(dim_feat, dim_rep)),
            ('act', nn.Tanh())
        ]))
        self.head = nn.Linear(dim_rep, dim_out)

        self.center_pose = nn.Parameter(
            torch.randn(n_frames // 3, num_joints, dim_feat))
        self.center_pos_embed = nn.Parameter(
            torch.zeros(1, num_joints, dim_feat))

    def forward(self, x):
        b = x.shape[0]
        pose_query = (self.center_pose.unsqueeze(0).expand(b, -1, -1, -1)
                      + self.center_pos_embed)
        x = self.joints_embed(x) + self.pos_embed
        for layer, temporal_layer in zip(self.layers, self.temporal_layers):
            x = layer(x)
            x, pose_query = temporal_layer(x, pose_query)
        x = self.norm(x)
        x = self.rep_logit(x)
        return self.head(x)
