import express from "express";
import bodyParser from "body-parser";
import path from "path";
import axios from "axios";
import Replicate from "replicate";
import fetch from "node-fetch";
import * as dotenv from "dotenv";

dotenv.config();

//AWS Part
//AWS Part
import aws from "aws-sdk";

import { Upload } from "@aws-sdk/lib-storage";
import { S3 } from "@aws-sdk/client-s3";

//AWS Configuration
const AWSConfig = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
};
aws.config.update(AWSConfig);

//AWS S3
const s3 = new S3();

const uploadToS3 = (name, buffer) => {
  return new Promise((resolve, reject) => {
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: name,
      Body: buffer,
      ACL: "public-read",
    };
    new Upload({
      client: s3,
      params,
    })
      .done()
      .then((data) => {
        return resolve(data);
      })
      .catch((error) => {
        console.log(error);
        reject(error);
      });
  });
};

const deleteFromS3 = (fileKey) => {
  return new Promise((resolve, reject) => {
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileKey,
    };
    s3.deleteObject(params, (error, data) => {
      if (error) {
        console.log(error);
        reject(error);
      }
      return resolve(data);
    });
  });
};

//Whatsapp Part

const app = express();
app.use(bodyParser.json());

const access_token = process.env.ACCESS_TOKEN;
const myToken = process.env.MY_TOKEN;

app.get("/webhook", (req, res) => {
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === myToken) {
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
      console.log("Invalid webhook subscription");
    }
  } else {
    console.log("Missing webhook parameters");
  }
});

app.post("/webhook", async (req, res) => {
  let reply = "Hey";

  if (req.body.entry[0].changes[0].value.messages) {
    // Get the phone number ID
    let phone_number_id =
      req.body.entry[0].changes[0].value.metadata.phone_number_id;

    // Get the sender's phone number
    let from = req.body.entry[0].changes[0].value.messages[0].from;

    // Get the message sent to your number
    let message = req.body.entry[0].changes[0].value.messages[0];
    console.log("JSON: " + JSON.stringify(message));

    if (message.text && message.text.body) {
      // Handle incoming text message
      let prompt = message.text.body + " ";
      console.log("From: " + from);

      //Set the reply to a simple message
      reply = "Hey";
    } else if (message.image.id) {
      // Handle incoming media message
      let image_id = message.image.id;
      console.log("Media Message ID: " + image_id);

      // Download image and save to server or process as needed
      await axios({
        method: "GET",
        url: "https://graph.facebook.com/v15.0/" + image_id,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access_token}`,
        },
      })
        .then(async (response) => {
          console.log("Image URL: " + JSON.stringify(response.data, null, 2));
          let image_url = response.data.url;
          await axios({
            method: "GET",
            url: image_url,
            maxBodyLength: Infinity,
            responseType: "arraybuffer",
            headers: {
              Authorization: `Bearer ${access_token}`,
            },
          }).then(async (r) => {
            //console.log("API Data: ", r.data);
            const binaryData = new Uint8Array(r.data);
            const buffer = Buffer.from(binaryData);
            const awsres = await uploadToS3(image_id + ".jpg", buffer);
            const image_url = JSON.stringify(awsres.Location, null, 2);
            console.log(typeof image_url);
            console.log("AWS URL: " + image_url);
            await repli(image_url)
              .then((rep) => {
                console.log(JSON.stringify(rep, null, 2));
              })
              .catch((error) => {
                console.log("Repli Error: " + error);
              });
          });
        })
        .catch((error) => {
          console.log("Error: " + error);
        });
    }

    axios({
      method: "POST",
      url:
        "https://graph.facebook.com/v15.0/" +
        phone_number_id +
        "/messages?access_token=" +
        access_token,
      data: {
        messaging_product: "whatsapp",
        to: from,
        text: { body: reply },
      },
      headers: { "Content-Type": "application/json" },
    });
  }
  res.status(200).send("EVENT_RECEIVED");
});

//Replicate Part

const repli = async (imageURL) => {
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
    fetch: fetch,
  });

  const model =
    "nightmareai/real-esrgan:42fed1c4974146d4d2414e2be2c5277c7fcf05fcc3a73abf41610695738c1d7b";
  const input = {
    image: `${imageURL}`,
    scale: 8,
    face_enhance: true,
  };
  const output = await replicate.run(model, { input });
  return output;
};

repli("https://priyansu.s3.ap-south-1.amazonaws.com/6497144750329614.jpg")
  .then((rep) => {
    console.log("Replicate Test Data: ");
    console.log(JSON.stringify(rep, null, 2));
  })
  .catch((error) => {
    console.log("Error: " + error);
  });

// axios({
//   method: "GET",
//   url: "https://api.replicate.com/v1/collections/super-resolution",
//   headers: {
//     "Content-Type": "application/json",
//     Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
//   },
// })
//   .then((response) => {
//     console.log("Replicate Data: ", response.data);
//   })
//   .catch((error) => {
//     console.log("Error: " + error);
//   });

app.use(express.static("public"));
app.use(express.static("dist"));

app.get("^/$", (req, res) => {
  res.sendFile(path.join(__dirname, "dist/index.html"));
});

app.listen(6000 || process.env.PORT, () =>
  console.log("Server is running on port " + process.env.PORT)
);
