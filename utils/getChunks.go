package utils

import (
	"context"
	"fmt"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"mflix/models"
)

// GetChunks downloads the particular chunks from mongo db collection
func GetChunks(chunksCollection *mongo.Collection, filesId string, start, end uint64) ([]byte, error) {
	var id, err = primitive.ObjectIDFromHex(filesId)
	if err != nil {
		return nil, err
	}

	// Selector for the chunks with n from start to end
	chunkSelector := bson.D{
		{"files_id", id},
		{"n", bson.D{{"$gte", start}}},
		{"n", bson.D{{"$lt", end}}},
	}

	// get the chunks from the given collection
	foundChunks, err := chunksCollection.Find(context.TODO(), chunkSelector)
	if err != nil {
		return nil, err
	}

	// unmarshal all the data
	var allChunks []models.FileChunk
	if err = foundChunks.All(context.TODO(), &allChunks); err != nil {
		return nil, err
	}

	// if no chunk found then return empty slice
	if allChunks == nil || len(allChunks) == 0 {
		return []byte{}, nil
	}

	// merge all the data into one
	var res = make([]byte, 0, len(allChunks)*len(allChunks[0].Data))
	for _, v := range allChunks {
		fmt.Printf("found chunk %d with id: %s\n", v.N, v.Id)
		res = append(res, v.Data...)
	}

	// return the merged data
	return res, nil
}