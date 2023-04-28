import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import * as dotenv from "dotenv";

dotenv.config();

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
            headers: {
              Authorization: `Bearer ${access_token}`,
            },
          })
            .then((r) => {
              console.log("Image: " + JSON.stringify(r.data, null, 2));
              // r.data.pipe(fs.createWriteStream("image.jpg"));
            })
            .catch((error) => {
              console.log(error);
            });
        })
        .catch((error) => {
          console.log(error);
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

app.use(express.static("public"));
app.use(express.static("dist"));

app.get("^/$", (req, res) => {
  res.sendFile(path.join(__dirname, "dist/index.html"));
});

app.listen(5000 || process.env.PORT, () =>
  console.log("Server is running on port " + process.env.PORT)
);
