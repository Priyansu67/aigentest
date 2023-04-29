import s3 from "./config/aws";



const uploadToS3 = (name,buffer) => {
  return new Promise((resolve, reject) => {
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: name,
      Body: buffer,
      ACL: "public-read",
    };
    s3.upload(params, (error, data) => {
      if (error) {
        console.log(error);
        reject(error);
      }
      return resolve(data);
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

module.exports = { uploadToS3, deleteFromS3 };
