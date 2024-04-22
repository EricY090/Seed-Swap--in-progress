import { users } from "../config/mongoCollections.js";
import { ObjectId } from "mongodb";
import bcryptjs from "bcryptjs";
import xss from "xss";
import usersValidation from "../usersValidation.js";

// discord, phone are allowed to be undefined. just be sure to enter them as undefined when calling function
/**
 *
 * @param {boolean} moderator
 * @param {string} username
 * @param {boolean} displayWishlist

 * @param {string | undefined} countryCode
 * @param {string | undefined} discord
 * @param {string | undefined} phone
 * @param {string | undefined} email
 * @param {string} password
 * @returns {string} userId
 * @throws {string} invalid fields, errors in validatoin, xss vulnerability, user already exists, mongo error "could not add user"
 */

const createUser = async (
  moderator, //required, bool
  username, //required, string
  displayWishlist, //required, bool
  countryCode, //required, string
  discord, //optional, string
  phone, //optional, string
  email, //optional, string
  password //required, string
) => {
  // TODO
  // check if username is in use, regardless of case

  //validating the required fields (moderator, userName, displayWishlist, countryCode, password)

  try {
    moderator = usersValidation.validateBoolean(moderator, "moderator");
    username = usersValidation.validateUsername(username);
    displayWishlist = usersValidation.validateBoolean(
      displayWishlist,
      "displayWishlist"
    );
    countryCode = usersValidation.validateCountryCode(countryCode);
    password = usersValidation.validatePassword(password);
  } catch (error) {
    throw error;
  }
  //xss sanitizing mandatory string fields (userName, countryCode, password)
  username = xss(username);
  countryCode = xss(countryCode);

  if (password !== xss(password)) {
    throw `${password}Password is an xss vulnerability`;
  }
  password = xss(password); //already did validation

  //validating + sanitizing optional string fields (discord, phone, email)
  if (discord) {
    discord = usersValidation.validateDiscord(discord);
    if (discord !== xss(discord)) {
      throw "Discord username is an xss vulnerability";
    }
    discord = xss(discord);
  }
  if (phone) {
    phone = usersValidation.validatePhoneNumber(phone);
    if (phone !== xss(phone)) {
      throw "Phone number is an xss vulnerability";
    }
    phone = xss(phone);
  }
  if (email) {
    // console.log(email);
    email = usersValidation.validateEmail(email);
    if (email !== xss(email)) {
      throw "Email is an xss vulnerability";
    }
    if (await emailInUse(email)) {
      throw "Email already in use";
    }
    email = xss(email);
  }

  //hashing password
  const hashedPassword = await bcryptjs.hash(password, 10);

  // checking if username is in use
  if (await userNameExists(username)) {
    throw "Username already in use";
  }

  //creating user object
  let newUser = {
    moderator: moderator,
    username: username,
    displayWishlist: displayWishlist,
    hashedPassword: hashedPassword,
    countryCode: countryCode,
    wishlist: [],
    inventory: [],
    discord: discord,
    phone: phone,
    email: email,
    avgRating: 0,
    growLog: [],
    profileComments: [],
  };
  const userCollection = await users();
  const insertInfo = await userCollection.insertOne(newUser);
  if (!insertInfo.acknowledged || !insertInfo.insertedId) {
    throw "Could not add user";
  }
  //   returs id of user just made
  return insertInfo.insertedId.toString();
};
/**
 *
 * @param {string} username
 * @returns boolean
 * @throws {string} "field incomplete", "field not string", mongo error
 * case insensitive search
 */
const userNameExists = async (username) => {
  const userCollection = await users();
  if (!username) throw "field incomplete";
  if (typeof username !== "string") throw "field not string";
  username = xss(username);
  let findingUser;
  try {
    const findingUser = await userCollection.findOne({
      username: { $regex: username, $options: "i" },
    });
  } catch (error) {
    throw error;
  }

  if (findingUser) {
    return true;
  }
  return false;
};
/**
 *
 * @param {string} email
 * @returns {boolean} true if email is in use, false otherwise
 * @throws {string} "field incomplete", "field not string", mongo error
 * case insensitive search
 */
const emailInUse = async (email) => {
  if (!email) throw "field incomplete";
  if (typeof email !== "string") throw "field not string";
  email = xss(email);

  const userCollection = await users();
  let findingUser;

  try {
    findingUser = await userCollection.findOne({
      email: { $regex: email, $options: "i" },
    });
  } catch (error) {
    throw error;
  }

  if (findingUser) {
    return true;
  }
  return false;
};
/**
 *
 * @param {string} username
 * @returns {object} user object
 * @throws {string} "field incomplete", "field not string", "User not found", mongo error
 */
const getUserByName = async (username) => {
  if (!username) throw "field incomplete";
  if (typeof username !== "string") throw "field not string";
  username = xss(username);
  const userCollection = await users();
  let findingUser;
  try {
    findingUser = await userCollection.findOne({
      username: { $regex: username, $options: "i" },
    });
  } catch (error) {
    throw error;
  }

  if (!findingUser) {
    throw "User not found";
  }
  return findingUser;
};

/**
 *
 * @param {string} userId
 * @returns {object} user object
 * @throws {string} "Invalid userId, User not found", xss vulnerability, inocmplete fields, type mismatch
 */
const getUserById = async (userId) => {
  //userId is a string
  if (!userId) throw "field incomplete";
  if (typeof userId !== "string") throw "field not string";
  try {
    userId = usersValidation.validateUserId(userId);
  } catch (error) {
    throw error;
  }
  if (userId !== xss(userId)) {
    throw "userId is an xss vulnerability";
  }
  if (!ObjectId.isValid(userId)) {
    throw "Invalid userId";
  }
  const userCollection = await users();
  const findingUser = await userCollection.findOne({
    _id: new ObjectId(userId),
  });
  if (!findingUser) {
    throw "User not found";
  }
  return findingUser;
};

/**
 *
 * @param {string} username
 * @param {string} password
 * @returns user object
 * @throws {string} "fields incomplete", "Username or password incorrect"
 */
const login = async (username, password) => {
  if (!username || !password) throw "fields incomplete";
  if (username !== xss(username)) throw "Username or password incorrect";
  if (password !== xss(password)) throw "Username or password incorrect";
  if (username !== usersValidation.validateUsername(username))
    throw "Username or password incorrect";
  if (password !== usersValidation.validatePassword(password))
    throw "Username or password incorrect";
  const userCollection = await users();
  //case insensitive search
  const findingUser = await userCollection.findOne({ username: username });
  if (!findingUser) throw "Username or password incorrect";
  const passwordMatch = await bcryptjs.compare(
    password,
    findingUser.hashedPassword
  );
  if (!passwordMatch) throw "Username or password incorrect";
  else {
    return findingUser;
  }
};

const getAllUsers = async () => {
  const userCollection = await users();
  const allUsers = await userCollection
    .find({})
    .toArray();
  allUsers.forEach((user) => {
    user._id = user._id.toString();
  });
  return allUsers;
};

//get users in order 
const getNClosestWishlistMatches = async (userId, N) => {
  //userId is a string
  if (!userId) throw "field incomplete";
  if (typeof N !== 'number') throw "N not a number";
  if (typeof userId !== "string") throw "field not string";
  try {
    userId = usersValidation.validateUserId(userId);
  } catch (error) {
    throw error;
  }
  if (userId !== xss(userId)) {
    throw "userId is an xss vulnerability";
  }
  if (!ObjectId.isValid(userId)) {
    throw "Invalid userId";
  }
  let user, allUsers, W;
  try{
    user = await getUserById(userId);
    W = user.wishlist;
    allUsers = await getAllUsers();
  } catch (error){
    throw error;
  }
  let finalArray = allUsers.sort((a, b) => {
    if(a.username < b.username){
      return -1;
    } else if(a.username > b.username){
      return 1;
    } else{
      return 0;
    };
  })
  .sort((a, b) => {
    const aMatchLen = a.inventory.filter((x) => W.includes(x)).length;
    const bMatchLen = b.inventory.filter((y) => W.includes(y)).length;
    return bMatchLen-aMatchLen;
  })
  .filter((x) => x._id.toString() !== user._id.toString())
  .slice(0, N)
  .map((user) => {
    user['wishlistMatches'] = user.inventory.filter((x) => W.includes(x)).length;
    return user;
  })
  return finalArray;
};

export default {
  createUser,
  userNameExists,
  emailInUse,
  getUserByName,
  getUserById,
  login,
  getNClosestWishlistMatches,
  getAllUsers
};
