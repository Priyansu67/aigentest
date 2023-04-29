const aws = require('aws-sdk');

//AWS Configuration
const AWSConfig = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
  };
  aws.config.update(AWSConfig);
  
module.exports = new aws.S3();