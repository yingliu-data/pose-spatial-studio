"""Proxy endpoint that forwards guest chat requests to the SecondBrain
agent-api container over Docker's internal network, bypassing Cloudflare
Access (which blocks CORS preflight OPTIONS requests).
"""

import logging

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

import config

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/secondbrain", tags=["secondbrain"])

_TARGET = config.SECONDBRAIN_INTERNAL_URL.rstrip("/") + "/api/v1/guest/chat"
_TIMEOUT = httpx.Timeout(connect=5.0, read=120.0, write=5.0, pool=5.0)


@router.post("/guest/chat")
async def proxy_guest_chat(request: Request):
    body = await request.body()

    headers = {"Content-Type": "application/json"}
    if origin := request.headers.get("Origin"):
        headers["Origin"] = origin

    client = httpx.AsyncClient(timeout=_TIMEOUT)

    req = client.build_request("POST", _TARGET, content=body, headers=headers)
    resp = await client.send(req, stream=True)

    async def stream():
        try:
            async for chunk in resp.aiter_bytes():
                yield chunk
        finally:
            await resp.aclose()
            await client.aclose()

    return StreamingResponse(
        stream(),
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type", "text/event-stream"),
    )
