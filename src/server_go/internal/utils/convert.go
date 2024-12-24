package utils

import (
	"encoding/json"
	"fmt"
	"strconv"
)

// InterfaceToString converts interface{} to string
func InterfaceToString(v interface{}) string {
	if v == nil {
		return ""
	}
	switch v := v.(type) {
	case string:
		return v
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	case int:
		return strconv.Itoa(v)
	case json.Number:
		return v.String()
	default:
		return fmt.Sprintf("%v", v)
	}
}

// InterfaceToInt converts interface{} to int
func InterfaceToInt(v interface{}) int {
	switch val := v.(type) {
	case float64:
		return int(val)
	case int:
		return val
	case string:
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
		return 0
	case json.Number:
		if i, err := val.Int64(); err == nil {
			return int(i)
		}
		return 0
	default:
		return 0
	}
}

// FormatFloat formats float values with high precision
func FormatFloat(v interface{}) string {
	switch val := v.(type) {
	case float64:
		return strconv.FormatFloat(val, 'f', 10, 64)
	case string:
		if f, err := strconv.ParseFloat(val, 64); err == nil {
			return strconv.FormatFloat(f, 'f', 10, 64)
		}
		return val
	default:
		return fmt.Sprintf("%v", v)
	}
}
