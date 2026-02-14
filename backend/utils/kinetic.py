from logging import getLogger, root
import numpy as np
import collections
from utils.filters import MedianFilter
from typing import Dict
from math import sin, cos

logger = getLogger(__name__)

HIERARCHY = {
    'hipCentre': [],
    'leftHip': ['hipCentre'], 'leftKnee': ['leftHip', 'hipCentre'], 
    'leftAnkle': ['leftKnee', 'leftHip', 'hipCentre'],
    'leftToe': ['leftAnkle', 'leftKnee', 'leftHip', 'hipCentre'],
    'rightHip': ['hipCentre'], 'rightKnee': ['rightHip', 'hipCentre'],
    'rightAnkle': ['rightKnee', 'rightHip', 'hipCentre'],
    'rightToe': ['rightAnkle', 'rightKnee', 'rightHip', 'hipCentre'],
    'neck': ['hipCentre'],
    'leftShoulder': ['neck', 'hipCentre'], 'leftElbow': ['leftShoulder', 'neck', 'hipCentre'],
    'leftWrist': ['leftElbow', 'leftShoulder', 'neck', 'hipCentre'],
    'rightShoulder': ['neck', 'hipCentre'], 'rightElbow': ['rightShoulder', 'neck', 'hipCentre'],
    'rightWrist': ['rightElbow', 'rightShoulder', 'neck', 'hipCentre'],
}

OFFSET_DIRECTIONS = {
            'leftHip': np.array([-1, 0, 0]),
            'leftKnee': np.array([0, -1, 0]),
            'leftAnkle': np.array([0, -1, 0]),
            'leftToe': np.array([0, 0, 1]),
            'rightHip': np.array([1, 0, 0]),
            'rightKnee': np.array([0, -1, 0]),
            'rightAnkle': np.array([0, -1, 0]),
            'rightToe': np.array([0, 0, 1]),
            'neck': np.array([0, -1, 0]),
            'leftShoulder': np.array([1, 0, 0]),
            'leftElbow': np.array([1, 0, 0]),
            'leftWrist': np.array([1, 0, 0]),
            'rightShoulder': np.array([-1, 0, 0]),
            'rightElbow': np.array([-1, 0, 0]),
            'rightWrist': np.array([-1, 0, 0]),
        }

class Converter:

    def __init__(self):
        self.kpts = {}
        joints = set()
        for joint, parents in HIERARCHY.items():
            joints.add(joint)
            for parent in parents:
                joints.add(parent)
        self.kpts['all_joints'] = list(joints)
        self.kpts['joints'] = list(joints)
        self.kpts['hierarchy'] = HIERARCHY
        self.kpts['root_joint'] = 'hipCentre'
        self.kpts['available_joints'] = set()
        self.get_bone_lengths()
        self.get_base_skeleton()

    def coordinate2angle(self, coordinates: Dict[str, float]) -> Dict[str, float]:
        """
        Convert 3D coordinates to joint angles (forward kinematics).
        Handles partial joint data - generates angles for joints with complete parent chains.
        """
        self.kpts['available_joints'] = set()
        
        for joint, coords in coordinates.items():
            if coords is not None and all(k in coords for k in ["x", "y", "z"]):
                x, y, z = coords["x"], coords["y"], coords["z"]
                if x is not None and y is not None and z is not None:
                    try:
                        coord_array = np.array([float(x), float(y), float(z)])
                        if not np.any(np.isnan(coord_array)):
                            self.kpts[joint] = coord_array
                            self.kpts['available_joints'].add(joint)
                    except (ValueError, TypeError) as e:
                        logger.warning(f"Invalid coordinate data for joint {joint}: {e}")

        self.add_hips_and_neck()

        if not self._has_minimum_joints():
            logger.warning("Insufficient joint data for angle calculation")
            return self.kpts

        self.get_bone_lengths()
        self.get_base_skeleton()
        self.calculate_joint_angles()
        
        self.root_trajectory = self.kpts.get("hipCentre", np.array([0., 0., 0.]))

        angles_dict = {joint.replace("_angles", ""): self.angle2quaternion(self.kpts[joint]) for joint in self.kpts if "_angles" in joint}
        return angles_dict
        # leftshouder angle axis[rotate around torsodirection, rotate arond shoulder to shoulder axis]
    
    def angle2quaternion(self, angle: np.ndarray) -> np.ndarray:
        """
        Convert joint angles to quaternion.
        Uses ZXY rotation order to match Decompose_R_ZXY: q = Rz(yaw) * Rx(pitch) * Ry(roll)
        """
        yaw, pitch, roll = angle
        cy, sy = cos(yaw/2), sin(yaw/2)
        cp, sp = cos(pitch/2), sin(pitch/2)
        cr, sr = cos(roll/2), sin(roll/2)

        qx = cy*sp*cr - sy*cp*sr
        qy = cy*cp*sr + sy*sp*cr
        qz = cy*sp*sr + sy*cp*cr
        qw = cy*cp*cr - sy*sp*sr

        return {"x": qx, "y": qy, "z": qz, "w": qw}
        
    def _has_minimum_joints(self) -> bool:
        """Check if we have minimum required joints to compute any angles."""
        available = self.kpts['available_joints']
        has_hip_center = 'hipCentre' in available
        has_any_limb = any(j in available for j in ['leftHip', 'rightHip', 'leftShoulder', 'rightShoulder'])
        return has_hip_center and has_any_limb

    def angle2coordinate(self, angles_dict: Dict[str, float]) -> Dict[str, float]:
        """
        Convert joint angles to 3D coordinates (inverse kinematics).
        Handles partial angle data - generates coordinates for joints where angles are available.
        """
        joints = []
        for joint, angles in angles_dict.items():
            if "_joint" in joint:
                joints.append(joint.replace("_joint", ""))
            self.kpts[joint] = angles
            
        self.kpts['hipCentre'] = getattr(self, 'root_trajectory', np.array([0., 0., 0.]))
        self.kpts['joints'] = joints
        coordinates_dict = collections.defaultdict(list)

        frame_rotations = {}
        for joint in self.kpts['joints']:
            angle_key = joint + '_angles'
            frame_rotations[joint] = self.kpts.get(angle_key, np.array([0., 0., 0.]))

        normalization = self.kpts.get('normalization', 1)
        base_skeleton = self.kpts.get('base_skeleton', {})

        for _j in self.kpts['joints']:
            if _j == 'hipCentre':
                coordinates_dict[_j].append([0, 0, 0])
                continue

            if _j not in self.kpts['hierarchy'] or _j not in base_skeleton:
                continue
                
            hierarchy = self.kpts['hierarchy'][_j]

            try:
                r1 = self.kpts['hipCentre'] / normalization

                for parent in hierarchy:
                    if parent == 'hipCentre':
                        continue
                    if parent not in base_skeleton or parent not in self.kpts['hierarchy']:
                        break
                    R = self.get_rotation_chain(parent, self.kpts['hierarchy'][parent], frame_rotations)
                    r1 = r1 + R @ base_skeleton[parent]
                else:
                    R_final = self.get_rotation_chain(hierarchy[0], hierarchy, frame_rotations)
                    r2 = r1 + R_final @ base_skeleton[_j]
                    coordinates_dict[_j].append(r2)
            except Exception as e:
                logger.warning(f"Error computing coordinates for joint {_j}: {e}")

        return coordinates_dict

    def get_rotation_chain(self, joint, hierarchy, frame_rotations):
        """Compute cumulative rotation matrix along the kinematic chain."""
        hierarchy = hierarchy[::-1]
        R = np.eye(3)
        for parent in hierarchy:
            if parent in frame_rotations:
                angles = frame_rotations[parent]
                _R = get_R_z(angles[0]) @ get_R_x(angles[1]) @ get_R_y(angles[2])
                R = R @ _R
        return R


    def get_joint_rotations(self, joint_name, joints_hierarchy, joints_offsets, frame_rotations, frame_pos):
        """Calculate rotation angles for a specific joint."""
        if joint_name not in joints_hierarchy:
            raise ValueError(f"Joint '{joint_name}' not found in hierarchy")
        if joint_name not in joints_offsets:
            raise ValueError(f"Joint '{joint_name}' not found in offset directions")
        if joint_name not in frame_pos:
            raise ValueError(f"Joint '{joint_name}' not found in frame positions")
            
        hierarchy = joints_hierarchy[joint_name]
        if not hierarchy or hierarchy[0] not in frame_pos:
            raise ValueError(f"Invalid hierarchy for joint '{joint_name}'")

        _invR = np.eye(3)
        for i, parent_name in enumerate(hierarchy):
            if i == 0:
                continue
            if parent_name not in frame_rotations:
                continue
            _r_angles = frame_rotations[parent_name]
            R = get_R_z(_r_angles[0]) @ get_R_x(_r_angles[1]) @ get_R_y(_r_angles[2])
            _invR = _invR @ R.T
            
        b = _invR @ (frame_pos[joint_name] - frame_pos[hierarchy[0]])
        
        b_norm = np.sqrt(np.sum(np.square(b)))
        if b_norm < 1e-8:
            return np.array([0., 0., 0.])

        offset = joints_offsets[joint_name]
        offset_norm = np.sqrt(np.sum(np.square(offset)))
        if offset_norm < 1e-8:
            return np.array([0., 0., 0.])

        try:
            _R = Get_R2(offset, b)
            tz, ty, tx = Decompose_R_ZXY(_R)
            return np.array([tz, tx, ty])
        except Exception as e:
            logger.warning(f"Error computing rotation for {joint_name}: {e}")
            return np.array([0., 0., 0.])

    def get_bone_lengths(self):
        """Calculate bone lengths from coordinate data."""
        bone_lengths = {}
        for joint in HIERARCHY:
            if joint == 'hipCentre':
                continue
            parent = self.kpts['hierarchy'][joint][0]
            if joint not in self.kpts or parent not in self.kpts:
                continue
            _bone = np.subtract(self.kpts[joint], self.kpts[parent])
            _bone_length = np.median(np.sqrt(np.sum(np.square(_bone), axis=-1)))
            bone_lengths[joint] = _bone_length

        self.kpts['bone_lengths'] = bone_lengths
        return self.kpts

    def get_base_skeleton(self):
        """Define skeleton with offset directions and bone lengths."""
        body_lengths = self.kpts.get('bone_lengths', {})

        normalization = 1
        base_skeleton = {'hipCentre': np.array([0, 0, 0])}

        def _set_length(joint_type):
            left_joint = 'left' + joint_type
            right_joint = 'right' + joint_type
            
            if left_joint in body_lengths and right_joint in body_lengths:
                avg_length = (body_lengths[left_joint] + body_lengths[right_joint]) / 2
                base_skeleton[left_joint] = OFFSET_DIRECTIONS[left_joint] * avg_length
                base_skeleton[right_joint] = OFFSET_DIRECTIONS[right_joint] * avg_length
            elif left_joint in body_lengths:
                base_skeleton[left_joint] = OFFSET_DIRECTIONS[left_joint] * body_lengths[left_joint]
                base_skeleton[right_joint] = OFFSET_DIRECTIONS[right_joint] * body_lengths[left_joint]
            elif right_joint in body_lengths:
                base_skeleton[right_joint] = OFFSET_DIRECTIONS[right_joint] * body_lengths[right_joint]
                base_skeleton[left_joint] = OFFSET_DIRECTIONS[left_joint] * body_lengths[right_joint]

        for joint_type in ['Hip', 'Knee', 'Ankle', 'Toe', 'Shoulder', 'Elbow', 'Wrist']:
            _set_length(joint_type)
        
        base_skeleton['neck'] = OFFSET_DIRECTIONS['neck'] * body_lengths.get('neck', 1)

        self.kpts['offset_directions'] = OFFSET_DIRECTIONS
        self.kpts['normalization'] = normalization
        self.kpts['base_skeleton'] = base_skeleton

    def add_hips_and_neck(self):
        """Compute derived joints (hipCentre, neck) from available joint data."""
        available = self.kpts.get('available_joints', set())
        
        if 'leftHip' in available and 'rightHip' in available:
            self.kpts['hipCentre'] = (self.kpts['leftHip'] + self.kpts['rightHip']) / 2
            self.kpts['available_joints'].add('hipCentre')
        elif 'hipCentre' not in available:
            logger.warning("Cannot compute hipCentre: missing leftHip or rightHip")
            
        if 'leftShoulder' in available and 'rightShoulder' in available:
            self.kpts['neck'] = (self.kpts['leftShoulder'] + self.kpts['rightShoulder']) / 2
            self.kpts['available_joints'].add('neck')

    def get_hips_position_and_rotation(self, frame_pos, root_joint='hipCentre', root_define_joints=['rightHip', 'neck']):
        """Calculate root position and rotation from hip center."""
        if root_joint not in frame_pos:
            raise ValueError(f"Root joint '{root_joint}' not found")
        for joint in root_define_joints:
            if joint not in frame_pos:
                raise ValueError(f"Root defining joint '{joint}' not found")

        root_position = frame_pos[root_joint]

        # root_u: X-axis (pointing to person's left, i.e., hipCentre → leftHip direction)
        # Flip direction: use hipCentre - rightHip to get +X pointing left
        root_u = root_position - frame_pos[root_define_joints[0]]
        root_u_norm = np.sqrt(np.sum(np.square(root_u)))
        root_u = np.array([1., 0., 0.]) if root_u_norm < 1e-8 else root_u / root_u_norm
            
        # root_v: Y-axis (pointing upward, neck - hipCentre)
        root_v = frame_pos[root_define_joints[1]] - frame_pos[root_joint]
        root_v_norm = np.sqrt(np.sum(np.square(root_v)))
        root_v = np.array([0., 1., 0.]) if root_v_norm < 1e-8 else root_v / root_v_norm
        
        # Orthogonalize: make root_v perpendicular to root_u
        root_v = root_v - np.dot(root_v, root_u) * root_u
        root_v_norm = np.sqrt(np.sum(np.square(root_v)))
        root_v = np.array([0., 1., 0.]) if root_v_norm < 1e-8 else root_v / root_v_norm
            
        # root_w: Z-axis (pointing forward, cross product of X and Y)
        root_w = np.cross(root_u, root_v)
        root_w_norm = np.sqrt(np.sum(np.square(root_w)))
        root_w = np.array([0., 0., 1.]) if root_w_norm < 1e-8 else root_w / root_w_norm

        C = np.array([root_u, root_v, root_w]).T
        # Use ZXY decomposition to match get_rotation_chain and angle2quaternion
        thetaz, thetay, thetax = Decompose_R_ZXY(C)
        root_rotation = np.array([thetaz, thetax, thetay])  # [tz, tx, ty] matching ZXY convention

        return root_position, root_rotation

    def calculate_joint_angles(self):
        """Calculate joint angles for all available joints with complete parent chains."""
        available = self.kpts.get('available_joints', set())
        
        frame_pos = {joint: self.kpts[joint].copy() 
                     for joint in available 
                     if joint in self.kpts and isinstance(self.kpts[joint], np.ndarray)}

        root_position = np.array([0., 0., 0.])
        root_rotation = np.array([0., 0., 0.])
        
        can_compute_root = all(j in frame_pos for j in ['hipCentre', 'rightHip', 'neck'])
        
        if can_compute_root:
            try:
                root_position, root_rotation = self.get_hips_position_and_rotation(frame_pos)
            except Exception as e:
                logger.warning(f"Failed to compute root position/rotation: {e}")
        
        frame_rotations = {'hipCentre': root_rotation}

        for joint in frame_pos:
            frame_pos[joint] = frame_pos[joint] - root_position

        max_connected_joints = 0
        computable_joints = []
        
        # Find out how many joints can be computed based on their visibility
        for joint in available:
            if joint in self.kpts['hierarchy']:
                hierarchy = self.kpts['hierarchy'][joint]
                if all(parent in available for parent in hierarchy):
                    computable_joints.append(joint)
                    max_connected_joints = max(max_connected_joints, len(hierarchy))

        depth = 2
        while depth <= max_connected_joints:

            for joint in computable_joints:
                hierarchy = self.kpts['hierarchy'].get(joint, [])
                if len(hierarchy) == depth:
                    if not self._can_safely_compute_rotation(joint, frame_pos, frame_rotations):
                        continue
                    try:
                        joint_rs = self.get_joint_rotations(
                            joint, self.kpts['hierarchy'], 
                            self.kpts['offset_directions'],
                            frame_rotations, frame_pos
                        )
                        frame_rotations[hierarchy[0]] = joint_rs
                    except Exception as e:
                        logger.warning(f"Failed to compute rotation for joint {joint}: {e}")
            depth += 1

        self._compute_wrist_rotations(frame_pos, frame_rotations)

        for _j in available:
            if _j not in frame_rotations:
                frame_rotations[_j] = np.array([0., 0., 0.])

        for joint in frame_rotations:
            self.kpts[joint + '_angles'] = frame_rotations[joint]

        self.kpts['computed_joints'] = list(frame_rotations.keys())

    def _compute_wrist_rotations(self, frame_pos, frame_rotations):
        """Compute wrist rotation from hand plane using index + thumb landmarks.

        A single finger direction (wrist→index) barely changes with hand rotation
        because it stays along the arm axis. By also using the thumb (which is
        perpendicular to the fingers in T-pose), we capture the full hand plane
        orientation, giving visible pronation/supination and flexion.
        """
        for side in ['left', 'right']:
            wrist = side + 'Wrist'
            index_joint = side + 'Index'
            thumb = side + 'Thumb'

            if wrist not in frame_pos or index_joint not in frame_pos:
                continue

            wrist_hierarchy = self.kpts['hierarchy'].get(wrist, [])
            if not wrist_hierarchy:
                continue

            # De-rotate by all wrist parent rotations to get base/T-pose frame
            _invR = np.eye(3)
            for parent in wrist_hierarchy:
                if parent in frame_rotations:
                    _r_angles = frame_rotations[parent]
                    R = get_R_z(_r_angles[0]) @ get_R_x(_r_angles[1]) @ get_R_y(_r_angles[2])
                    _invR = _invR @ R.T

            v_index = _invR @ (frame_pos[index_joint] - frame_pos[wrist])
            idx_norm = np.sqrt(np.sum(np.square(v_index)))
            if idx_norm < 1e-8:
                continue

            fwd_rest = np.array([1, 0, 0]) if side == 'left' else np.array([-1, 0, 0])
            up_rest = np.array([0, 1, 0])

            # Full 3DOF rotation using index + thumb hand plane
            if thumb in frame_pos:
                v_thumb = _invR @ (frame_pos[thumb] - frame_pos[wrist])
                thumb_norm = np.sqrt(np.sum(np.square(v_thumb)))

                if thumb_norm > 1e-8:
                    hand_fwd = v_index / idx_norm
                    hand_up = v_thumb / thumb_norm

                    # Orthogonalize: remove forward component from up
                    hand_up = hand_up - np.dot(hand_up, hand_fwd) * hand_fwd
                    up_norm = np.sqrt(np.sum(np.square(hand_up)))

                    if up_norm > 1e-8:
                        hand_up = hand_up / up_norm
                        hand_normal = np.cross(hand_fwd, hand_up)

                        R_current = np.column_stack([hand_fwd, hand_up, hand_normal])
                        normal_rest = np.cross(fwd_rest, up_rest)
                        R_rest = np.column_stack([fwd_rest, up_rest, normal_rest])

                        R_wrist = R_current @ R_rest.T
                        tz, ty, tx = Decompose_R_ZXY(R_wrist)
                        frame_rotations[wrist] = np.array([tz, tx, ty])
                        continue

            # Fallback: 2DOF from single finger direction
            try:
                hand_fwd = v_index / idx_norm
                _R = Get_R2(fwd_rest, hand_fwd)
                tz, ty, tx = Decompose_R_ZXY(_R)
                frame_rotations[wrist] = np.array([tz, tx, ty])
            except Exception as e:
                logger.warning(f"Error computing wrist rotation for {wrist}: {e}")

    def _can_safely_compute_rotation(self, joint: str, frame_pos: dict, frame_rotations: dict) -> bool:
        """Check if we have all required data to compute rotation for a joint."""
        hierarchy = self.kpts['hierarchy'].get(joint, [])
        
        if joint not in frame_pos:
            return False
        if hierarchy and hierarchy[0] not in frame_pos:
            return False
        for i, parent in enumerate(hierarchy):
            if i > 0 and parent not in frame_rotations:
                return False
        if 'offset_directions' in self.kpts and joint not in self.kpts['offset_directions']:
            return False
        return True


# Rotation matrices
def get_R_x(theta):
    return np.array([[1, 0, 0],
                     [0, np.cos(theta), -np.sin(theta)],
                     [0, np.sin(theta), np.cos(theta)]])

def get_R_y(theta):
    return np.array([[np.cos(theta), 0, np.sin(theta)],
                     [0, 1, 0],
                     [-np.sin(theta), 0, np.cos(theta)]])

def get_R_z(theta):
    return np.array([[np.cos(theta), -np.sin(theta), 0],
                     [np.sin(theta), np.cos(theta), 0],
                     [0, 0, 1]])


def Get_R2(A, B):
    """Calculate rotation matrix to transform vector A to vector B."""
    norm_A = np.sqrt(np.sum(np.square(A)))
    norm_B = np.sqrt(np.sum(np.square(B)))
    
    if norm_A < 1e-8 or norm_B < 1e-8:
        return np.eye(3)

    uA = A / norm_A
    uB = B / norm_B

    v = np.cross(uA, uB)
    s = np.sqrt(np.sum(np.square(v)))
    c = np.sum(uA * uB)

    if s < 1e-8:
        if c > 0:
            return np.eye(3)
        else:
            perp = np.cross(uA, np.array([1, 0, 0]) if abs(uA[0]) < 0.9 else np.array([0, 1, 0]))
            perp = perp / np.sqrt(np.sum(np.square(perp)))
            return 2 * np.outer(perp, perp) - np.eye(3)

    vx = np.array([[0, -v[2], v[1]],
                   [v[2], 0, -v[0]],
                   [-v[1], v[0], 0]])

    return np.eye(3) + vx + vx @ vx * ((1 - c) / s**2)


def Decompose_R_ZYX(R):
    """Decompose rotation matrix as Rz @ Ry @ Rx."""
    thetaz = np.arctan2(R[1, 0], R[0, 0])
    thetay = np.arctan2(-R[2, 0], np.sqrt(R[2, 1]**2 + R[2, 2]**2))
    thetax = np.arctan2(R[2, 1], R[2, 2])
    return thetaz, thetay, thetax


def Decompose_R_ZXY(R):
    """Decompose rotation matrix as Rz @ Rx @ Ry."""
    thetaz = np.arctan2(-R[0, 1], R[1, 1])
    thetay = np.arctan2(-R[2, 0], R[2, 2])
    thetax = np.arctan2(R[2, 1], np.sqrt(R[2, 0]**2 + R[2, 2]**2))
    return thetaz, thetay, thetax

