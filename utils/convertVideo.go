package utils

import (
	"fmt"
	"go.mongodb.org/mongo-driver/mongo/gridfs"
	"os"
	"os/exec"
	"strings"
)

func ConvertAndUpload(bucket *gridfs.Bucket, filePath string, fileName string) {
	n := strings.Split(filePath, ".")
	filePathHalf := strings.Join(n[:len(n)-1], ".")
	extension := n[len(n)-1]

	filePath720 := filePathHalf + "720." + extension
	filePath480 := filePathHalf + "480." + extension

	err := ConvertVideo(filePath, filePath720, filePath480)
	if err != nil {
		fmt.Println(err)
		return
	}

	n2 := strings.Split(fileName, ".")
	fileNameHalf := strings.Join(n2[:len(n2)-1], ".")

	id1, err := UploadToMongo(bucket, filePath, fileName)
	if err != nil {
		fmt.Println(err)
		return
	}
	id2, err := UploadToMongo(bucket, filePath720, fileNameHalf+"720."+extension)
	if err != nil {
		fmt.Println(err)
		return
	}
	id3, err := UploadToMongo(bucket, filePath480, fileNameHalf+"480."+extension)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Println(id1, id2, id3)

	//os.Remove(filePath)
	//os.Remove(filePath720)
	//os.Remove(filePath480)
}

func ConvertVideo(filepath, filePath720, filePath480 string) error {
	ffmpeg := exec.Command("ffmpeg", "-i", filepath, "-movflags", "faststart", "-strict", "-2", "-vf", "scale=-2:720", filePath720)
	ffmpeg.Stdout = os.Stdout
	err := ffmpeg.Run()
	if err != nil {
		return err
	}
	ffmpeg = exec.Command("ffmpeg", "-i", filepath, "-movflags", "faststart", "-strict", "-2", "-vf", "scale=-2:480", filePath480)
	ffmpeg.Stdout = os.Stdout
	err = ffmpeg.Run()
	return err
}