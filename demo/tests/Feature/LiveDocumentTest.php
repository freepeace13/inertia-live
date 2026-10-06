<?php

namespace Tests\Feature;

use App\Models\Document;
use Freepeace13\InertiaLive\Facades\Live;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;
use Tests\TestCase;

class LiveDocumentTest extends TestCase
{
    use RefreshDatabase;

    private function createDocument(string $title = 'Q3 plan'): Document
    {
        $response = $this->post('/documents', ['title' => $title]);
        $response->assertRedirect();

        return Document::firstOrFail();
    }

    public function test_show_page_carries_live_bindings(): void
    {
        $document = $this->createDocument();

        $this->get("/documents/{$document->uuid}")
            ->assertOk()
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Documents/Show')
                ->where('_live.bindings.0.topic', "documents.{$document->uuid}")
                ->where('_live.bindings.0.channel', "live.documents.{$document->uuid}")
                ->where('_live.bindings.0.props', ['document', 'comments'])
                ->where('_live.bindings.0.cursor', 0));
    }

    public function test_renaming_projects_and_signals_the_document_prop(): void
    {
        $document = $this->createDocument();
        Live::fake();

        $this->put("/documents/{$document->uuid}", ['title' => 'Q4 plan'])->assertRedirect();

        $this->assertSame('Q4 plan', $document->fresh()->title);
        Live::assertChanged("documents.{$document->uuid}", props: ['document']);
        Live::assertChangedTimes("documents.{$document->uuid}", 1);
    }

    public function test_commenting_signals_the_comments_prop_only(): void
    {
        $document = $this->createDocument();
        Live::fake();

        $this->post("/documents/{$document->uuid}/comments", ['body' => 'Looks good'])->assertRedirect();

        Live::assertChanged("documents.{$document->uuid}", props: ['comments']);
        $this->assertSame(1, $document->comments()->count());
    }

    public function test_other_documents_are_not_signalled(): void
    {
        $document = $this->createDocument();
        Live::fake();

        $this->put("/documents/{$document->uuid}", ['title' => 'Renamed'])->assertRedirect();

        Live::assertNothingChangedFor('documents.some-other-uuid');
    }
}
