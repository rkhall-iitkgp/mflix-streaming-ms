const express = require("express");
const {
	convertAndUploadToS3,
	deleteLocalFile,
} = require("../Utils/s3ffmpegupload");
const router = express.Router();
const fs = require("fs");
const WebSocket = require("ws");
const path = require("path");
const { wss } = require("../index");
const { default: axios } = require("axios");
router.post("/upload", (req, res) => {
	if (!req.files || Object.keys(req.files).length === 0) {
		return res.status(400).send("No files were uploaded.");
	}
	const videoName = new Date().getTime();
	const videoFile = req.files.video;
	const uploadPath = path.join(
		__dirname,
		"../temp/uploads",
		videoName + videoFile.name
	);
	const uploadfilePath = "../temp/uploads/" + videoName + videoFile.name;
	console.log("uploadfilePath,uploadPath", uploadfilePath, uploadPath);
	videoFile.mv(uploadPath, (err) => {
		if (err) {
			console.error(err);
			return res.status(500).send(err);
		}
		wss.clients.forEach((client) => {
			if (client.readyState === WebSocket.OPEN) {
				client.send(JSON.stringify({ progress: 50 }));
			}
		});
		convertAndUploadToS3(uploadfilePath, videoName, wss).then((uploadurl) => {
			wss.clients.forEach((client) => {
				if (client.readyState === WebSocket.OPEN) {
					client.send(JSON.stringify({ progress: 100 }));
				}
			});
			deleteLocalFile(uploadPath);
			console.log("uploadurl", uploadurl);
			res.json({
				message: "Video uploaded successfully.",
				uploadurl,
			});
		});
		// Simulating immediate completion since this is a server-side action
	});
});

router.post("/upload-from-url", async (req, res) => {
	const { videoUrl } = req.body;
	try {
		const response = await axios({
			url: videoUrl,
			method: "GET",
			responseType: "stream",
		});
		const videoName = new Date().getTime().toString();
		const fileName = path.basename(new URL(videoUrl).pathname);
		const filePath = path.join(
			__dirname,
			"../temp/uploads",
			videoName + fileName
		);

		const uploadfilePath = "../temp/uploads/" + videoName + fileName;
		const fileStream = fs.createWriteStream(filePath);
		let totalSize = 0;
		if (response.headers["content-length"]) {
			totalSize = parseInt(response.headers["content-length"], 10);
		}

		let downloadedSize = 0;
		response.data.on("data", (chunk) => {
			downloadedSize += chunk.length;
			const progress = Math.floor((downloadedSize / totalSize) * 50);
			// Broadcast progress update
			console.log("progress", progress);
			wss.clients.forEach((client) => {
				if (client.readyState === WebSocket.OPEN) {
					client.send(JSON.stringify({ progress }));
				}
			});
		});

		response.data.pipe(fileStream);

		fileStream.on("finish", () => {
			console.log("filePath,fileName", filePath, "movie12");
			convertAndUploadToS3(uploadfilePath, videoName, wss).then((uploadurl) => {
				wss.clients.forEach((client) => {
					if (client.readyState === WebSocket.OPEN) {
						client.send(JSON.stringify({ progress: 100 }));
					}
				});
				deleteLocalFile(filePath);
				console.log("uploadurl", uploadurl);
				res.json({
					uploadurl,
					message: "Video uploaded successfully.",
				});
			});
		});
	} catch (error) {
		console.error(error);
		res.status(400).send("Failed to upload video from URL.");
	}
});

module.exports = router;
