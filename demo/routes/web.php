<?php

use App\Http\Controllers\DocumentController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/documents');

$documents = function () {
    Route::get('/documents', [DocumentController::class, 'index'])->name('documents.index');
    Route::post('/documents', [DocumentController::class, 'store'])->name('documents.store');
    Route::get('/documents/{document}', [DocumentController::class, 'show'])->name('documents.show');
    Route::put('/documents/{document}', [DocumentController::class, 'rename'])->name('documents.rename');
    Route::post('/documents/{document}/comments', [DocumentController::class, 'comment'])->name('documents.comment');
};

// Vue frontend.
$documents();

// React frontend: same controllers, events and projector, served under /react.
Route::prefix('react')->name('react.')->group($documents);
