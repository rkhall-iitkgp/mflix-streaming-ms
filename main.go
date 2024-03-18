package main

import (
	"context"
	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"log"
	"mflix/api"
	"os"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Fatalln("Error loading .env")
	}
	mongoUrl := os.Getenv("MONOG_URI")
	ctx := context.Background()
	// Connect to mongo db
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoUrl))
	defer func() {
		if err = client.Disconnect(ctx); err != nil {
			panic(err)
		}
	}()

	db := client.Database("test")

	app := fiber.New(fiber.Config{AppName: "mflix streaming", BodyLimit: 1024 * 1024 * 1024})

	// Register routes for uploading and streaming video
	app.Get("/video/:file_id", api.StreamVideo(db))
	app.Post("/video", api.UploadVideo(db))
	app.Get("/", VideoHtml)

	log.Fatalln(app.Listen(":8080"))
}
func VideoHtml(ctx *fiber.Ctx) error {
	return ctx.SendFile("index.html")
}