package main

import (
	"context"
	"log"
	"mflix/api"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
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

	databaseConnection := client.Database("test")

	app := fiber.New(fiber.Config{AppName: "mflix streaming", BodyLimit: 1024 * 1024 * 1024})
	app.Use(cors.New())

	// Allow all origins to connect
	app.Use(cors.New(cors.Config{
		AllowOrigins: "*",
		AllowHeaders: "Origin, Content-Type, Accept",
	}))

	app.Get("/video/:file_id", api.StreamVideo(databaseConnection))
	app.Post("/video", api.UploadVideo(databaseConnection))
	app.Get("/", VideoHtml)

	log.Fatalln(app.Listen(":8080"))
}
func VideoHtml(ctx *fiber.Ctx) error {
	return ctx.SendFile("index.html")
}