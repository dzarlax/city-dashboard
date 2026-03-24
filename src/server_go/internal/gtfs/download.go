package gtfs

import (
	"archive/zip"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// DownloadAndLoad fetches a GTFS ZIP from url, extracts it to a temp directory,
// loads it, and returns the parsed Data. The temp directory is cleaned up automatically.
func DownloadAndLoad(url string) (*Data, error) {
	log.Printf("GTFS: downloading from %s", url)

	tmpZip, err := downloadToTemp(url)
	if err != nil {
		return nil, fmt.Errorf("download: %w", err)
	}
	defer os.Remove(tmpZip)

	tmpDir, err := os.MkdirTemp("", "gtfs-*")
	if err != nil {
		return nil, fmt.Errorf("mkdirtemp: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	if err := extractZip(tmpZip, tmpDir); err != nil {
		return nil, fmt.Errorf("extract: %w", err)
	}

	return Load(tmpDir)
}

func downloadToTemp(url string) (string, error) {
	client := &http.Client{Timeout: 5 * time.Minute}

	resp, err := client.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP %d from %s", resp.StatusCode, url)
	}

	f, err := os.CreateTemp("", "gtfs-*.zip")
	if err != nil {
		return "", err
	}
	defer f.Close()

	n, err := io.Copy(f, resp.Body)
	if err != nil {
		os.Remove(f.Name())
		return "", err
	}
	log.Printf("GTFS: downloaded %.1f MB to %s", float64(n)/1e6, f.Name())
	return f.Name(), nil
}

func extractZip(zipPath, destDir string) error {
	r, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer r.Close()

	for _, f := range r.File {
		if f.FileInfo().IsDir() {
			continue
		}
		dest := filepath.Join(destDir, filepath.Base(f.Name))

		out, err := os.Create(dest)
		if err != nil {
			return err
		}

		rc, err := f.Open()
		if err != nil {
			out.Close()
			return err
		}

		_, err = io.Copy(out, rc)
		rc.Close()
		out.Close()
		if err != nil {
			return err
		}
	}
	log.Printf("GTFS: extracted %d files to %s", len(r.File), destDir)
	return nil
}
