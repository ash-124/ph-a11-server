const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const fs = require('fs');
require("dotenv").config();
// console.log(jsonData)
const port = process.env.PORT || 7500;
const app = express();
const corsOptions = {
  origin: ['http://localhost:5173'],
  credentials: true,
  optionalSuccessStatus: 200,
}
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.780sf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
//middleware to verify jwt token
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) return res.status(401).send({ message: 'unauthorize access' })
  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {

    if (err) {
      return res.status(401).send({ message: 'unauthorize access' })
    }

    req.user = decoded;
    next()
  })
}
async function run() {
  try {
    const database = client.db("Modern-Hotel");
    const roomsCollection = database.collection("rooms");
    const usersBookedRooms = database.collection('booked-rooms')
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
    // generate a webtoken
    app.post("/jwt", (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.SECRET_KEY, {
        expiresIn: "365d",
      });
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? "none" : "strict",
      }).send({ success: true })
    });
    // clear token from cookie
    app.get('/logOut', async (req, res) => {
      res.clearCookie("token", {
        maxAge: 0,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV ? 'none' : 'strict',
      }).send({ success: true, clearCookie: true })
    })


    app.post("/rooms", async (req, res) => {
      const data = fs.readFileSync('./roomsData.json', 'utf8');
      const rooms = JSON.parse(data);
      console.log(rooms)
      const result = await roomsCollection.insertMany(rooms);
      res.send(result);
      console.log('console from post req', result)
    });
    app.put("/addJobs/:id", async (req, res) => {
      const id = req.params.id;
      const updateData = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: updateData,
      };
      const options = {
        upsert: true,
      };
      const result = await jobsCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    });
    app.get("/allRooms", async (req, res) => {
      const { featured } = req.query;
      if (featured) {
        const data = roomsCollection.find().limit(6);
        const result = await data.toArray();
        res.send(result);
      } else {
        const data = roomsCollection.find();
        const result = await data.toArray();
        res.send(result);
      }
      app.get("/rooms/:id", async (req, res) => {
        const id = req.params.id;
        const query = { id: id };
        const result = await roomsCollection.findOne(query);
        res.send(result);

      })
      app.post('/booked-rooms', async (req, res) => {
        const data = req.body;
        const query = { id: data.roomId };
        const updateDoc = {
          $set: {
            availability: false,
          }
        }
        const updateResult = await roomsCollection.updateOne(query, updateDoc)
        const result = await usersBookedRooms.insertOne(data);
        res.send(result);
        console.log(updateResult)
      })


    });



  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("Hello from SoloSphere Server....");
});

app.listen(port, () => console.log(`Server running on port ${port}`))
