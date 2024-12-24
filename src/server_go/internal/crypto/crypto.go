package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"fmt"
	"net/url"
	"strings"
)

// sanitizeBase64 убирает некорректные символы для Base64
func sanitizeBase64(input string) string {
	input = strings.ReplaceAll(input, " ", "")
	input = strings.ReplaceAll(input, "\n", "")
	input = strings.ReplaceAll(input, "\r", "")
	return input
}

// removePadding удаляет PKCS#7-заполнение
func removePadding(data []byte) ([]byte, error) {
	length := len(data)
	if length == 0 {
		return nil, fmt.Errorf("decrypted data is empty")
	}
	padding := int(data[length-1])
	if padding > length || padding == 0 {
		return nil, fmt.Errorf("invalid padding size")
	}
	for i := 0; i < padding; i++ {
		if data[length-1-i] != byte(padding) {
			return nil, fmt.Errorf("invalid padding")
		}
	}
	return data[:length-padding], nil
}

func Decrypt(inputString, b64key, b64iv string) (string, error) {
	// Base64 decode ключа и IV
	key, err := base64.StdEncoding.DecodeString(b64key)
	if err != nil {
		return "", fmt.Errorf("key Base64 decode error: %v", err)
	}

	iv, err := base64.StdEncoding.DecodeString(b64iv)
	if err != nil {
		return "", fmt.Errorf("IV Base64 decode error: %v", err)
	}

	// URL Decode и очистка Base64
	inputString = sanitizeBase64(inputString)

	// Base64 Decode
	ciphertext, err := base64.StdEncoding.DecodeString(inputString)
	if err != nil {
		return "", fmt.Errorf("Base64 decode error: %v", err)
	}

	// Проверка длины
	if len(ciphertext)%aes.BlockSize != 0 {
		return "", fmt.Errorf("ciphertext length is not a multiple of the block size")
	}

	// Создание AES блока
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("AES key error: %v", err)
	}

	// Расшифровка
	mode := cipher.NewCBCDecrypter(block, iv)
	plaintext := make([]byte, len(ciphertext))
	mode.CryptBlocks(plaintext, ciphertext)

	// Удаление PKCS#7-заполнения
	plaintext, err = removePadding(plaintext)
	if err != nil {
		return "", fmt.Errorf("padding removal error: %v", err)
	}

	return string(plaintext), nil
}

func Encrypt(inputString, b64key, b64iv string) (string, error) {
	// Декодирование ключа и IV из Base64
	key, err := base64.StdEncoding.DecodeString(b64key)
	if err != nil {
		return "", fmt.Errorf("key decode error: %v", err)
	}

	iv, err := base64.StdEncoding.DecodeString(b64iv)
	if err != nil {
		return "", fmt.Errorf("IV decode error: %v", err)
	}

	// Добавление PKCS7-заполнения
	padding := aes.BlockSize - (len(inputString) % aes.BlockSize)
	padtext := make([]byte, len(inputString)+padding)
	copy(padtext, []byte(inputString))
	for i := len(inputString); i < len(padtext); i++ {
		padtext[i] = byte(padding)
	}

	// Создание блока AES
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("AES cipher creation error: %v", err)
	}

	// Шифрование данных
	ciphertext := make([]byte, len(padtext))
	mode := cipher.NewCBCEncrypter(block, iv)
	mode.CryptBlocks(ciphertext, padtext)

	// Кодирование в Base64 и URL-совместимый формат
	encoded := base64.StdEncoding.EncodeToString(ciphertext)
	return url.QueryEscape(encoded), nil
}
