# Go POC: `ttwid`

This POC is only about one thing: proving that `ttwid` can be extracted and reused as a valid cookie in the final TikTok request.

## What it proves

1. `ttwid` is present in the browser cookie jar.
2. `ttwid` is not available through `document.cookie` when it is `HttpOnly`.
3. `page.cookies()` can read it.
4. The extracted `ttwid` can be sent back in the final request and still return a valid response.

## Where the logic lives

- [main.go](main.go) - Go client that requests a signed URL, merges `ttwid`, and performs the final request.
- [README.md](README.md) - Short run instructions.
- [../../server.mjs](../../server.mjs) - Local sidecar that returns the signed URL and cookie set.

## How to use it

1. Start the local signature server from the repository root:

```bash
npm start
```

2. Extract the current `ttwid` from the browser session.

3. Run the Go client with that value:

```bash
cd examples/go-sign-fetch
go run . -url "https://www.tiktok.com/api/search/general/full/?aid=1988&app_name=tiktok_web&device_platform=web_pc&keyword=discord&count=6&cursor=0&search_id=1" -ttwid "YOUR_TTWID" -out "discord-response.json"
```

## What the Go client does

- Calls `POST /signature` on the sidecar.
- Receives `signed_url`, `cookies`, and `user_agent`.
- Replaces only the `ttwid` entry when `-ttwid` is provided.
- Sends the final request with:
  - `Cookie`
  - `User-Agent`
  - `Referer`
  - `Accept`
- Saves the response body to the file passed in `-out`.

## Notes

- `ttwid` is used as a cookie, not as part of the signature algorithm.
- If the request is valid, the response should be JSON and not empty.
- The last validated search example wrote the body to `discord-response.json`.
