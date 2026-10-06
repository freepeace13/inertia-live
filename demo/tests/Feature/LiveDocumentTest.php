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

    public function test_react_frontend_renders_its_own_components_and_root_view(): void
    {
        $this->post('/react/documents', ['title' => 'React doc'])
            ->assertRedirectContains('/react/documents/');

        $document = Document::firstOrFail();

        $this->get("/react/documents/{$document->uuid}")
            ->assertOk()
            ->assertSee('build/assets/react-') // the React Vite entry, not the Vue one
            ->assertInertia(fn (AssertableInertia $page) => $page
                ->component('Documents/Show')
                ->where('_live.bindings.0.topic', "documents.{$document->uuid}")
                ->where('_live.bindings.0.props', ['document', 'comments']));

        $this->get('/react/documents')
            ->assertInertia(fn (AssertableInertia $page) => $page->component('Documents/Index'));
    }

    public function test_vue_frontend_keeps_its_own_root_view(): void
    {
        $document = $this->createDocument();

        $this->get("/documents/{$document->uuid}")
            ->assertOk()
            ->assertDontSee('build/assets/react-')
            ->assertInertia(fn (AssertableInertia $page) => $page->component('Documents/Show'));
    }

    public function test_both_frontends_share_the_same_topic_and_signals(): void
    {
        $document = $this->createDocument();
        Live::fake();

        $this->put("/react/documents/{$document->uuid}", ['title' => 'From React'])->assertRedirect();

        $this->assertSame('From React', $document->fresh()->title);
        Live::assertChanged("documents.{$document->uuid}", props: ['document']);
    }
}
