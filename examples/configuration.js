var options = {
    steamid64: '', // Automatically update your inventory on bptf, set the steamid of the account here
    token: '', // Your backpack.tf access token
    key: '', // Your steam api key
    retryTime: 2000, // Time to wait before trying to do an action again, in milliseconds
    waitTime: 1000, // Time to wait before adding a new action, this is used to combine multiple actions into one request,
    items: 'instance of tf2-items' // Can take an instance of the tf2-items module instead of creating a new one
};