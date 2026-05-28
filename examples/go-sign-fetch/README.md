# Go sign-and-fetch POC

This example asks the local signature server for a signed TikTok URL, then performs the final request with Go's `net/http` client using the cookies returned by the server.

## Run

1. Start the local server from the repository root:

```bash
npm start
```

2. Run the Go example:

```bash
cd examples/go-sign-fetch
go run .
```

Optional flags:

```bash
go run . -url "https://www.tiktok.com/api/post/item_list/?aid=1988&app_name=tiktok_web&device_platform=web_pc&secUid=...&cursor=0&count=6"
go run . -server "http://localhost:8080"
```
