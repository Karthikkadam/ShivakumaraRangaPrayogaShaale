// Dynamic configuration for the client
window.appConfig = {
    apiUrl: `${window.location.protocol}//${window.location.hostname}${window.location.port ? ':' + window.location.port : ''}/api`,
    baseUrl: `${window.location.protocol}//${window.location.hostname}${window.location.port ? ':' + window.location.port : ''}`
};
