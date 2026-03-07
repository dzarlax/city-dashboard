package api

import (
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/gin-gonic/gin"
	"golang.org/x/net/html"
)

// LineRef represents a transit line badge
type LineRef struct {
	Number string `json:"number"`
	Color  string `json:"color"`
}

// TransitChange represents a single change entry from bgprevoz.rs
type TransitChange struct {
	Lines       []LineRef `json:"lines"`
	Description string    `json:"description"`
	ChangeType  string    `json:"changeType"`
	Dates       string    `json:"dates"`
	DetailURL   string    `json:"detailUrl"`
}

var (
	changesCacheMu  sync.RWMutex
	changesCacheVal []TransitChange
	changesCachedAt time.Time
)

const changesCacheTTL = 15 * time.Minute
const bgPrevozURL = "https://www.bgprevoz.rs/linije/aktuelne-izmene"

func (app *App) HandleTransitChanges(c *gin.Context) {
	changesCacheMu.RLock()
	if changesCacheVal != nil && time.Since(changesCachedAt) < changesCacheTTL {
		items := changesCacheVal
		changesCacheMu.RUnlock()
		c.JSON(http.StatusOK, gin.H{"items": items, "total": len(items)})
		return
	}
	changesCacheMu.RUnlock()

	items, err := scrapeTransitChanges()
	if err != nil {
		log.Printf("transit-changes scrape error: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch transit changes"})
		return
	}

	changesCacheMu.Lock()
	changesCacheVal = items
	changesCachedAt = time.Now()
	changesCacheMu.Unlock()

	c.JSON(http.StatusOK, gin.H{"items": items, "total": len(items)})
}

func scrapeTransitChanges() ([]TransitChange, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("GET", bgPrevozURL, nil)
	if err != nil {
		return nil, err
	}
	// Mimic a browser to avoid bot-blocking
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; CityDashboard/1.0)")
	req.Header.Set("Accept-Language", "sr,en;q=0.9")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http get: %w", err)
	}
	defer resp.Body.Close()

	doc, err := html.Parse(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("html parse: %w", err)
	}

	table := findNode(doc, isElement("table"))
	if table == nil {
		return nil, fmt.Errorf("table not found on page")
	}

	tbody := findNode(table, isElement("tbody"))
	if tbody == nil {
		tbody = table
	}

	var items []TransitChange
	for row := tbody.FirstChild; row != nil; row = row.NextSibling {
		if row.Type != html.ElementNode || row.Data != "tr" {
			continue
		}
		item := parseChangeRow(row)
		if len(item.Lines) > 0 || item.Description != "" {
			items = append(items, item)
		}
	}
	return items, nil
}

func parseChangeRow(row *html.Node) TransitChange {
	var item TransitChange

	// Line badges are in the first <th> as divs with inline background-color
	th := findNode(row, isElement("th"))
	if th != nil {
		walkNodes(th, func(n *html.Node) {
			if n.Type == html.ElementNode && n.Data == "div" {
				style := attr(n, "style")
				if strings.Contains(style, "background") {
					color := extractCSSColor(style)
					text := strings.TrimSpace(nodeText(n))
					if text != "" {
						item.Lines = append(item.Lines, LineRef{Number: text, Color: color})
					}
				}
			}
		})
	}

	// td cells: description, type, dates, detail-link
	var tds []*html.Node
	for child := row.FirstChild; child != nil; child = child.NextSibling {
		if child.Type == html.ElementNode && child.Data == "td" {
			tds = append(tds, child)
		}
	}

	if len(tds) >= 1 {
		item.Description = strings.TrimSpace(nodeText(tds[0]))
	}
	if len(tds) >= 2 {
		item.ChangeType = strings.TrimSpace(nodeText(tds[1]))
	}
	if len(tds) >= 3 {
		item.Dates = strings.TrimSpace(nodeText(tds[2]))
	}
	if len(tds) >= 4 {
		if a := findNode(tds[3], isElement("a")); a != nil {
			item.DetailURL = attr(a, "href")
		}
	}

	return item
}

// --- HTML traversal helpers ---

func isElement(tag string) func(*html.Node) bool {
	return func(n *html.Node) bool {
		return n.Type == html.ElementNode && n.Data == tag
	}
}

func findNode(root *html.Node, match func(*html.Node) bool) *html.Node {
	if match(root) {
		return root
	}
	for c := root.FirstChild; c != nil; c = c.NextSibling {
		if found := findNode(c, match); found != nil {
			return found
		}
	}
	return nil
}

func walkNodes(root *html.Node, fn func(*html.Node)) {
	fn(root)
	for c := root.FirstChild; c != nil; c = c.NextSibling {
		walkNodes(c, fn)
	}
}

func attr(n *html.Node, key string) string {
	for _, a := range n.Attr {
		if a.Key == key {
			return a.Val
		}
	}
	return ""
}

func nodeText(n *html.Node) string {
	var sb strings.Builder
	walkNodes(n, func(c *html.Node) {
		if c.Type == html.TextNode {
			sb.WriteString(c.Data)
		}
	})
	// Collapse whitespace
	return strings.Map(func(r rune) rune {
		if unicode.IsSpace(r) {
			return ' '
		}
		return r
	}, sb.String())
}

// extractCSSColor extracts the color value from an inline style like "background-color: #e81728"
func extractCSSColor(style string) string {
	for _, part := range strings.Split(style, ";") {
		part = strings.TrimSpace(part)
		if strings.Contains(strings.ToLower(part), "background") {
			idx := strings.Index(part, ":")
			if idx >= 0 {
				return strings.TrimSpace(part[idx+1:])
			}
		}
	}
	return ""
}
