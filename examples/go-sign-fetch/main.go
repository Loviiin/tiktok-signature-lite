package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type signatureResponse struct {
	Status string `json:"status"`
	Data   struct {
		SignedURL string `json:"signed_url"`
		Cookies   string `json:"cookies"`
		Navigator struct {
			UserAgent string `json:"user_agent"`
		} `json:"navigator"`
	} `json:"data"`
	Message string `json:"message"`
}

type fetchResponse struct {
	Status    string `json:"status"`
	HTTPStatus int    `json:"httpStatus"`
	Data      any    `json:"data"`
	Message   string `json:"message"`
}

func main() {
	serverURL := flag.String("server", "http://localhost:8080", "signature server base URL")
	targetURL := flag.String("url", "https://www.tiktok.com/api/post/item_list/?aid=1988&app_name=tiktok_web&device_platform=web_pc&secUid=MS4wLjABAAAAtBazTpLuo5XSFwEiX3gkaeV4ZY7u071I08MUNFL5B_zZoelUkTWrhCVvxK7LqAkr&cursor=0&count=6", "target TikTok URL")
	ttwidOverride := flag.String("ttwid", "", "override ttwid cookie value")
	outputPath := flag.String("out", "response.json", "output file path for the response body")
	showBody := flag.Int("body-chars", 1200, "max response body chars to print")
	flag.Parse()

	sig, err := requestSignature(*serverURL, *targetURL)
	if err != nil {
		fmt.Fprintln(os.Stderr, "signature error:", err)
		os.Exit(1)
	}

	fmt.Println("Signed URL:")
	fmt.Println(sig.Data.SignedURL)
	fmt.Println()
	fmt.Println("Cookies received from server:")
	fmt.Println(sig.Data.Cookies)
	fmt.Println()

	cookieHeader := mergeCookieHeaders(sig.Data.Cookies, *ttwidOverride)

	status, body, err := doRequest(sig.Data.SignedURL, cookieHeader, sig.Data.Navigator.UserAgent)
	if err != nil {
		fmt.Fprintln(os.Stderr, "request error:", err)
		os.Exit(1)
	}

	if err := os.WriteFile(*outputPath, []byte(body), 0644); err != nil {
		fmt.Fprintln(os.Stderr, "warning: could not save response file:", err)
	} else {
		fmt.Println("Saved response to:", *outputPath)
	}

	fmt.Println("HTTP status:", status)
	fmt.Println("Response body:")
	fmt.Println(truncate(body, *showBody))
}

func mergeCookieHeaders(baseCookieHeader, ttwidOverride string) string {
	if strings.TrimSpace(ttwidOverride) == "" {
		return baseCookieHeader
	}

	jar := map[string]string{}
	addCookies := func(raw string) {
		for _, part := range strings.Split(raw, ";") {
			part = strings.TrimSpace(part)
			if part == "" {
				continue
			}
			kv := strings.SplitN(part, "=", 2)
			if len(kv) != 2 {
				continue
			}
			jar[kv[0]] = kv[1]
		}
	}

	addCookies(baseCookieHeader)
	if strings.HasPrefix(ttwidOverride, "ttwid=") {
		addCookies(ttwidOverride)
	} else {
		jar["ttwid"] = ttwidOverride
	}

	ordered := make([]string, 0, len(jar))
	if v, ok := jar["ttwid"]; ok && v != "" {
		ordered = append(ordered, "ttwid="+v)
		delete(jar, "ttwid")
	}
	for k, v := range jar {
		ordered = append(ordered, k+"="+v)
	}
	return strings.Join(ordered, "; ")
}

func requestSignature(serverURL, targetURL string) (*signatureResponse, error) {
	payload := map[string]string{"url": targetURL}
	data, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest(http.MethodPost, strings.TrimRight(serverURL, "/")+"/signature", bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	content, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var sig signatureResponse
	if err := json.Unmarshal(content, &sig); err != nil {
		return nil, fmt.Errorf("decode signature response: %w; body=%s", err, string(content))
	}
	if sig.Status != "ok" {
		return nil, fmt.Errorf("signature server returned %q: %s", sig.Status, sig.Message)
	}
	if sig.Data.SignedURL == "" {
		return nil, fmt.Errorf("missing signed_url in response: %s", string(content))
	}
	return &sig, nil
}

func doRequest(signedURL, cookies, userAgent string) (int, string, error) {
	req, err := http.NewRequest(http.MethodGet, signedURL, nil)
	if err != nil {
		return 0, "", err
	}
	if cookies != "" {
		req.Header.Set("Cookie", cookies)
	}
	if userAgent != "" {
		req.Header.Set("User-Agent", userAgent)
	}
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Referer", "https://www.tiktok.com/")

	client := &http.Client{Timeout: 90 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0, "", err
	}
	defer resp.Body.Close()

	content, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, "", err
	}

	return resp.StatusCode, string(content), nil
}

func truncate(s string, max int) string {
	if max <= 0 || len(s) <= max {
		return s
	}
	return s[:max] + "..."
}
