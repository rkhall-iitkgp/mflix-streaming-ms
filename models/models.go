package models

import (
	"go.mongodb.org/mongo-driver/bson"
	"time"
)

type FileStored struct {
	Id         string    `bson:"_id"`
	Length     uint64    `bson:"length"`
	ChunkSize  uint64    `bson:"chunkSize"`
	UploadDate time.Time `bson:"uploadDate"`
	Filename   string    `bson:"filename"`
	Metadata   bson.Raw  `bson:"metadata"`
}

type FileChunk struct {
	Id      string `bson:"_id"`
	FilesId string `bson:"files_id"`
	N       uint64 `bson:"n"`
	Data    []byte `bson:"data"`
}