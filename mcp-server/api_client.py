"""Async HTTP client for the Potatoes backend API."""

import os
import httpx


class PotatoesAPI:
    """Thin async wrapper around the Potatoes backend REST API."""

    def __init__(self):
        self.base_url = os.environ.get("POTATOES_API_URL", "http://localhost:8000")
        self.token = os.environ.get("POTATOES_API_TOKEN", "")
        self._client: httpx.AsyncClient | None = None

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=f"{self.base_url}/api",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=30.0,
            )
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def get(self, path: str, params: dict | None = None) -> dict | list:
        resp = await self.client.get(path, params=params)
        resp.raise_for_status()
        return resp.json()

    async def post(self, path: str, json: dict | None = None) -> dict:
        resp = await self.client.post(path, json=json)
        resp.raise_for_status()
        if resp.status_code == 204:
            return {"status": "ok"}
        return resp.json()

    async def put(self, path: str, json: dict | None = None) -> dict:
        resp = await self.client.put(path, json=json)
        resp.raise_for_status()
        return resp.json()

    async def patch(self, path: str, json: dict | None = None) -> dict:
        resp = await self.client.patch(path, json=json)
        resp.raise_for_status()
        return resp.json()

    async def delete(self, path: str, params: dict | None = None) -> dict:
        resp = await self.client.delete(path, params=params)
        resp.raise_for_status()
        if resp.status_code == 204:
            return {"status": "deleted"}
        return resp.json()


api = PotatoesAPI()
