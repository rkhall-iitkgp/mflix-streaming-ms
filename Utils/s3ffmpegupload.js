const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");
const AWS = require("aws-sdk");
const WebSocket = require("ws");
const dotenv = require("dotenv");
const path = require("path");
dotenv.config();
const bucketName = "mflix-vids";
const s3 = new AWS.S3({
	accessKeyId: process.env.AWS_ACCESS_ID,
	secretAccessKey: process.env.AWS_ACCESS_SECRET_KEY,
});
async function convertAndUploadToS3(inputVideo, movieName, wss) {
	const resolutions = [
		{ name: "480", resolution: "854x480", bitrate: "1000k" },
		{ name: "360", resolution: "640x360", bitrate: "2000k" },
		{ name: "720", resolution: "1280x720", bitrate: "3000k" },
		{ name: "1080", resolution: "1920x1080", bitrate: "4000k" },
		// { name: "2160", resolution: "3840x2160", bitrate: "8000k" },
	]; // Resolutions for HLS conversion
	// const inputVideo = "input.mkv"; // Your input video file
	// const movieName = "movie4";
	const inputpath = path.join(__dirname, inputVideo);
	console.log("inputpath", inputpath);
	var fileuploaded = 0;
	await Promise.all(
		resolutions.map((resolution) => {
			return convertVideo(
				inputpath,
				resolution,
				resolutions,
				fileuploaded,
				movieName,
				wss
			);
		})
	);
	generateMasterPlaylist(movieName, resolutions);
	console.log("delete");
	return `https://mflix-vids.s3.ap-south-1.amazonaws.com/movies/${movieName}/master.m3u8`;
}

async function convertVideo(
	inputFile,
	resolution,
	resolutions,
	fileuploaded,
	movieName,
	wss
) {
	return new Promise((resolve, reject) => {
		const outputFolder = `temp/${movieName}/${resolution.name}p`;
		fs.mkdirSync(outputFolder, { recursive: true });
		ffmpeg(inputFile)
			.output(`${outputFolder}/index.m3u8`)
			.videoCodec("libx264")
			.audioCodec("aac")
			.size(resolution.resolution)
			.outputOptions([
				"-hls_time 10",
				"-hls_playlist_type vod",
				`-b:v ${resolution.bitrate}`,
				`-hls_key_info_file enc.keyinfo`,
			])
			.on("error", (err) => {
				console.error("Error occurred: " + err);
			})
			.on("end", () => {
				console.log("Conversion finished");
				fileuploaded = fileuploaded + 1;
				console.log("fileuploaded", fileuploaded);
				uploadToS3(
					outputFolder,

					fileuploaded
				)
					.then(async (res) => {
						await res;
						console.log("resolved");
						resolve();
					})
					.catch((err) => {
						reject(err);
					});
			})
			.on("progress", (progress) => {
				console.log(
					"progress",
					50 + (fileuploaded + 1) * (progress.percent / 100) * (25 / 1),
					progress.percent,
					fileuploaded,
					1
				);
				if (progress.percent) {
					wss.clients.forEach((client) => {
						if (client.readyState === WebSocket.OPEN) {
							client.send(
								JSON.stringify({
									progress: Math.floor(
										50 +
											(fileuploaded + 1) * (progress.percent / 100) * (50 / 1)
									),
								})
							);
						}
					});
				}
			})
			.run();
	});
}

function generateMasterPlaylist(movieName, resolutions) {
	const masterPlaylist = `movies/${movieName}/master.m3u8`;
	const masterPlaylistpath = `temp/${movieName}/master.m3u8`;
	const startingcontent = `#EXTM3U\n#EXT-X-VERSION:3\n`;
	console.log("started creating master playlist");
	const content = resolutions
		.map(
			(resolution) =>
				`#EXT-X-STREAM-INF:BANDWIDTH=500000,NAME=${resolution.name}p,RESOLUTION=${resolution.resolution}\n${resolution.name}p/index.m3u8`
		)
		.join("\n");
	fs.writeFileSync(masterPlaylistpath, startingcontent + content);
	console.log("finished creating master playlist");
	fs.readFile(masterPlaylistpath, (err, data) => {
		if (err) {
			console.error("Error reading master playlist file: " + err.message);
			return;
		}
		const params = {
			Bucket: bucketName,
			Key: masterPlaylist,
			Body: data,
			ACL: "public-read",
		};
		s3.upload(params, (err, data) => {
			if (err) {
				console.error("Error uploading master playlist file: " + err.message);
				return;
			}
			console.log(
				"Master playlist file uploaded successfully: " + data.Location
			);
			deleteLocalFile(masterPlaylist);

			deleteLocalFolder(movieName);
		});
	});
}

async function uploadToS3(folder, fileuploaded) {
	return new Promise((resolve, reject) => {
		fs.readdir(folder, async (err, files) => {
			if (err) {
				console.error("Error reading directory: " + err.message);
				reject(err);
				return;
			}
			await Promise.all(
				files.map((file, id) => {
					return new Promise(async (resolve, reject) => {
						const filePath = `${folder}/${file}`;
						const s3Key = `movies/${folder}/${file}`;
						fs.readFile(filePath, (err, data) => {
							if (err) {
								console.error("Error reading file: " + err.message);
								reject(err);
								return;
							}
							const params = {
								Bucket: bucketName,
								Key: s3Key,
								Body: data,
								ACL: "public-read",
							};
							s3.upload(params, (err, data) => {
								if (err) {
									console.error("Error uploading file: " + err.message);
									// reject(err);
									return;
								}
								console.log("File uploaded successfully: " + data.Location);
								resolve();
								deleteLocalFile(filePath);
							});
						});
						console.log(
							"progress: ",
							50 + fileuploaded * ((parseInt(id) + 1) / files.length) * (25 / 1)
						);
					});
				})
			);
			console.log("fileuploaded", fileuploaded);
			// if (fileuploaded == 2) {
			// 	generateMasterPlaylist(movieName, resolutions);
			// }
			resolve();
		});
	});
}
function deleteLocalFile(filePath) {
	fs.unlink(filePath, (err) => {
		if (err) {
			console.error("Error deleting file: " + err.message);
			return;
		}
		console.log("Local file deleted: " + filePath);
	});
}

function deleteLocalFolder(folder) {
	fs.rm(folder, { recursive: true }, (err) => {
		if (err) {
			console.error("Error deleting folder: " + err.message);
			return;
		}
		console.log("Local folder deleted: " + folder);
	});
}
module.exports = { convertAndUploadToS3, deleteLocalFile, uploadToS3 };
