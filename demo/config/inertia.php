<?php

return [

    // Two frontends, one folder each. Inertia's test assertions look for the page
    // component on disk, so list both folders.
    'pages' => [
        'paths' => [
            resource_path('js/vue/Pages'),
            resource_path('js/react/Pages'),
        ],
        'extensions' => ['vue', 'jsx'],
    ],

];
