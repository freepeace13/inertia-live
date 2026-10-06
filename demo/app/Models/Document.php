<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Document extends Model
{
    protected $primaryKey = 'uuid';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];

    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class, 'document_uuid', 'uuid');
    }
}
