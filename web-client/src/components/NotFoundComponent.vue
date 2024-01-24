<template>
    <div class="not-found">
      <h1>404 - Page Not Found</h1>
      <p>Sorry, the page you are looking for does not exist or has been moved.</p>
      <router-link to="/">Go to Home</router-link>
    </div>
  </template>
  
  <script>
  export default {
    name: "NotFoundComponent"
  };
  </script>
  
  <style>
  .not-found {
    text-align: center;
    padding: 50px;
  }
  
  .not-found h1 {
    font-size: 2em;
    margin-bottom: 20px;
  }
  
  .not-found p {
    margin-bottom: 20px;
  }
  
  .not-found a {
    display: inline-block;
    padding: 10px 20px;
    background-color: #007bff;
    color: white;
    border-radius: 5px;
    text-decoration: none;
  }
  </style>
  