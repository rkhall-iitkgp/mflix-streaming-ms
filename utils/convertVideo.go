package utils

import (
	"fmt"
	"go.mongodb.org/mongo-driver/mongo/gridfs"
	"os"
	"os/exec"
	"strings"
)

// ConvertAndUploadVideo convert the given video to 720 and 480 and uploads it to mongo gridfs
func ConvertAndUploadVideo(bucket *gridfs.Bucket, filePath, fileName, extension string) {
	n := strings.Split(filePath, ".")
	filePathStem := strings.Join(n[:len(n)-1], ".")

	filePath720 := filePathStem + "720." + extension
	filePath480 := filePathStem + "480." + extension
	filePathTrailer := filePathStem + "trailer." + extension

	err := ConvertVideo(filePath, filePath720, filePath480, filePathTrailer)
	if err != nil {
		fmt.Println(err)
		return
	}

	n2 := strings.Split(fileName, ".")
	fileNameStem := strings.Join(n2[:len(n2)-1], ".")

	idOriginal, err := UploadToMongo(bucket, filePath, fileName)
	if err != nil {
		fmt.Println(err)
		return
	}
	id720p, err := UploadToMongo(bucket, filePath720, fileNameStem+"720."+extension)
	if err != nil {
		fmt.Println(err)
		return
	}
	id480p, err := UploadToMongo(bucket, filePath480, fileNameStem+"480."+extension)
	if err != nil {
		fmt.Println(err)
		return
	}
	idTrailer, err := UploadToMongo(bucket, filePathTrailer, fileNameStem+"trailer."+extension)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Println(idOriginal, id720p, id480p, idTrailer)

	// cleanup the files after uploading
	os.Remove(filePath)
	os.Remove(filePath720)
	os.Remove(filePath480)
	os.Remove(filePathTrailer)
}

func ConvertVideo(filepath, filePath720, filePath480, filePathTrailer string) error {
	ffmpeg := exec.Command("ffmpeg", "-i", filepath, "-movflags", "faststart", "-strict", "-2", "-vf", "scale=-2:720", filePath720)
	ffmpeg.Stdout = os.Stdout
	err := ffmpeg.Run()
	if err != nil {
		return err
	}
	ffmpeg = exec.Command("ffmpeg", "-i", filepath, "-movflags", "faststart", "-strict", "-2", "-vf", "scale=-2:480", filePath480)
	ffmpeg.Stdout = os.Stdout
	err = ffmpeg.Run()
	if err != nil {
		return err
	}
	ffmpeg = exec.Command("ffmpeg", "-t", "30", "-i", filepath, "-acodec", "copy", filePathTrailer)
	ffmpeg.Stdout = os.Stdout
	err = ffmpeg.Run()
	return err
}