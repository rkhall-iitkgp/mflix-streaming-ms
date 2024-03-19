package api

import (
	"context"
	"errors"
	"fmt"
	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"mflix/models"
	"mflix/utils"
	"net/http"
	"strconv"
	"strings"
)

const ChunkSize = 261120

// StreamVideo is the streaming handler
func StreamVideo(db *mongo.Database) func(ctx *fiber.Ctx) error {
	return func(ctx *fiber.Ctx) (err error) {
		defer func() {
			// recover from panic if one occurred. Set err to nil otherwise.
			if recover() != nil {
				err = errors.New("array index out of bounds")
			}
		}()

		// Get the files collection
		filesCollection := db.Collection("videos.files")

		// Get the starting point from headers
		requestedRange := ctx.GetReqHeaders()["Range"][0]
		startByte, err := strconv.ParseUint(strings.Split(strings.Split(requestedRange, "=")[1], "-")[0], 10, 64)
		if err != nil {
			return ctx.Status(http.StatusInternalServerError).JSON(map[string]string{"err": err.Error()})
		}
		startChunk := startByte / ChunkSize

		// Get the file id from params
		fileId, err := primitive.ObjectIDFromHex(ctx.Params("file_id"))
		if err != nil {
			return ctx.Status(http.StatusInternalServerError).JSON(map[string]string{"err": err.Error()})
		}

		fileSelector := bson.D{{"_id", fileId}}
		var foundFile models.FileInfo
		if err := filesCollection.FindOne(context.TODO(), fileSelector).Decode(&foundFile); err != nil {
			return ctx.Status(http.StatusInternalServerError).JSON(map[string]string{"err": err.Error()})
		}

		//fmt.Println(foundFile)

		chunksCollection := db.Collection("videos.chunks")

		// Get the data in the chunks of the given chunk numbers
		videoBytes, err := utils.GetChunks(chunksCollection, fileId.Hex(), startChunk, startChunk+1)
		if err != nil {
			return ctx.Status(http.StatusInternalServerError).JSON(map[string]string{"err": err.Error()})
		}

		// Set appropriate headers
		ctx.Set("Content-Range",
			fmt.Sprintf("bytes %d-%d/%d", startByte,
				startByte+uint64(len(videoBytes))-1, foundFile.Length))
		ctx.Set("Accept-Ranges", "bytes")
		ctx.Set("Content-Length", fmt.Sprint(len(videoBytes)))
		ctx.Set("Content-Type", "video/mp4")

		return ctx.Status(206).Send(videoBytes)
	}
}