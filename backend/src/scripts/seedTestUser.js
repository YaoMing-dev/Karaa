const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// Test user data
const testUserData = {
  name: 'Hong Thanh',
  email: 'thanhmeo@gmail.com',
  password: 'password123', // Will be hashed by pre-save hook
  provider: 'local',
  isEmailVerified: true, // Set to true so user can login immediately
  role: 'user',
  lastLogin: new Date()
};

async function seedTestUser() {
  try {
    console.log('🔄 STEP 1: Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/resume-builder');
    console.log('✅ MongoDB connected');

    console.log('\n🔄 STEP 2: Checking if test user already exists...');
    const existingUser = await User.findOne({ email: testUserData.email, deletedAt: null });

    if (existingUser) {
      console.log('⚠️  Test user already exists!');
      console.log(`   ID: ${existingUser._id}`);
      console.log(`   Name: ${existingUser.name}`);
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Email Verified: ${existingUser.isEmailVerified}`);
      console.log(`   Created: ${existingUser.createdAt}`);

      console.log('\n🔄 STEP 3: Updating existing test user...');
      existingUser.name = testUserData.name;
      existingUser.password = testUserData.password; // Will be hashed by pre-save hook
      existingUser.isEmailVerified = true;
      existingUser.provider = 'local';
      existingUser.lastLogin = new Date();
      await existingUser.save();

      console.log('✅ Test user updated successfully!');
    } else {
      console.log('📝 Test user does not exist. Creating new user...');

      console.log('\n🔄 STEP 3: Creating test user...');
      const user = await User.create(testUserData);

      console.log('✅ Test user created successfully!');
      console.log(`   ID: ${user._id}`);
      console.log(`   Name: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Email Verified: ${user.isEmailVerified}`);
    }

    console.log('\n✅✅✅ SUCCESS! ✅✅✅');
    console.log('\n📋 TEST USER CREDENTIALS:');
    console.log(`   Email: ${testUserData.email}`);
    console.log(`   Password: ${testUserData.password}`);
    console.log(`   Name: ${testUserData.name}`);
    console.log('\n👉 You can now login with these credentials!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 11000) {
      console.error('❌ Duplicate key error - user might exist with soft delete. Check deletedAt field.');
    }
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 MongoDB disconnected');
    process.exit(0);
  }
}

seedTestUser();
