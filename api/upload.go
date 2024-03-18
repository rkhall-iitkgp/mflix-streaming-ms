package api

import (
	"fmt"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/gridfs"
	"go.mongodb.org/mongo-driver/mongo/options"
	"io"
	"mflix/utils"
	"net/http"
	"os"
	"path/filepath"
)

func UploadVideo(db *mongo.Database) func(ctx *fiber.Ctx) error {
	return func(c *fiber.Ctx) (err error) {
		defer func() {
			// recover from panic if one occurred. Set err to nil otherwise.
			if recover() != nil {
				//err = errors.New("array index out of bounds")
			}
		}()
		// Get the file from body
		file, err := c.FormFile("video")
		if err != nil {
			return err
		}
		if file == nil {
			_, err = c.Status(http.StatusBadRequest).WriteString("Not ok")
			return err
		}
		fileBytes, err := file.Open()

		// Make a temporary file to store the content
		fmt.Println(file.Header.Get("Content-Type"))
		//extension, err := mime.ExtensionsByType(file.Header.Get("Content-Type"))
		extension := filepath.Ext(file.Filename)
		tmpFile, err := os.CreateTemp("tmp", "mflix.*."+extension)
		if err != nil {
			return err
		}

		_, err = io.Copy(tmpFile, fileBytes)

		// Get the gridfs bucket to store the video
		opt := options.GridFSBucket().SetName("videos")
		bucket, err := gridfs.NewBucket(db, opt)
		if err != nil {
			return err
		}

		// convert and upload the video on a separate go routine
		go utils.ConvertAndUpload(bucket, tmpFile.Name(), file.Filename)

		_, err = c.WriteString("OK")
		return err
	}
}