import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler( async (req,res) => {
    // take out the required information from req
    const {userName, email, fullName, password} = req.body
    console.log(userName, email, fullName, password)
    // validation - not empty
    if(
        [userName,email,fullName,password].some(field => field?.trim()==="")
    ){
        throw new ApiError(400,"All fields are required")
    }
    // check if user already present in db - userName and email
    const existedUser = await User.findOne({
        $or: [{userName: userName.toLowerCase() }, { email: email.toLowerCase() }]
    });
    if(existedUser){
        console.log("Unsuccessful attempt as user is already present !")
        throw new ApiError(409,"User with this userName or email exists")
    }
    console.log(existedUser)
    // check for images and avatar
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;
        // let coverImageLocalPath;
        // if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        //     coverImageLocalPath = req.files.coverImage[0].path
        // }
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }
    // upload to cloudinary, avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = coverImageLocalPath ? await uploadOnCloudinary(coverImageLocalPath) : null;
    
    if(!avatar){
        throw new ApiError(400,"Avatar file is required")
    }
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    const user = await User.create({
        fullName,
        avatar : avatar.url,
        coverImage : coverImage?.url || "",
        email : email.toLowerCase(),
        password,
        userName : userName.toLowerCase()
    })
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if(!user){
        throw new ApiError(500,"Something went wrong in registering user")
    }
    if(!createdUser){
        throw new ApiError(500,"Something went wrong in retrieving registered user")
    }
    // return res
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully !")
    )
    
})


export {registerUser}