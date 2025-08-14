import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefereshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return {accessToken, refreshToken}


    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}

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

const loginUser = asyncHandler( async (req,res) => {
    // get userName/email and password from req
    const {userName, email, password} = req.body
    // find the user 
    if(!(email || userName)){
        throw new ApiError(400, "user name or email is required")
    }
    const user = await User.findOne({
        $or: [{userName: userName }, { email: email }]
    })
    if(!user){
        throw new ApiError(404,"User does not exist. Please register first.")
    }
    // password check
    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401,"Invalid user credentials")
    }
    // generate access and refresh tokens
    
    const {accessToken, refreshToken} = await generateAccessAndRefereshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    // send to user access and refresh tokens in cookies
    const options = {
        httpOnly : true,
        secure : true
    }
    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user : loggedInUser, 
                accessToken, 
                refreshToken
            },
            "User logged in successfully"
        )
    )
})

const logoutUser = asyncHandler( async(req,res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken : 1
            }
        },
        {
            new : true
        }
    )

    const options = {
        httpOnly : true,
        secure : true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200, {}, "User logged out"))
})

const refreshAccessToken = asyncHandler( async (req,res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if(!incomingRefreshToken){
        throw new ApiError(401,"No refresh token")
    }
    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
        const user = await User.findById(decodedToken?._id)
        if(!user){
            throw new ApiError(401, "Invalid refresh token - corrupted")
        }
        if(incomingRefreshToken != user.refreshToken){
            throw new ApiError(401, "Invalid refresh token - expired")
        }
        const options = {
            httpOnly : true,
            secure : true
        }
        const {newAccessToken, newRefreshToken} = await generateAccessAndRefereshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",newAccessToken)
        .cookie("refreshToken",newRefreshToken)
        .json(
            new ApiResponse(
                200,
                {accessToken:newAccessToken,refreshToken:newRefreshToken},
                "Access token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }
}
)


export {registerUser, loginUser, logoutUser, refreshAccessToken}