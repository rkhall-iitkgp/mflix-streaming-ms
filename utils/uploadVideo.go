package utils

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/gridfs"
	"io"
	"os"
)

func UploadToMongo(bucket *gridfs.Bucket, filePath string, fileName string) (primitive.ObjectID, error) {
	file, err := os.Open(filePath)
	defer file.Close()
	if err != nil {
		return primitive.ObjectID{}, err
	}
	return bucket.UploadFromStream(fileName, io.Reader(file))
}