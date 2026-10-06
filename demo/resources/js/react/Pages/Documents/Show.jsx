import { Link, useForm } from '@inertiajs/react';
import { useLive } from '@freepeace13/inertia-live-react';

export default function Show({ document, comments }) {
    const { status, lastSyncedAt, pause, resume } = useLive();

    const rename = useForm({ title: document.title });
    const comment = useForm({ body: '' });

    return (
        <main className="mx-auto max-w-2xl p-8">
            <Link href="/react/documents" className="text-sm text-blue-600 underline">
                All documents
            </Link>

            <p className="mt-4 text-sm text-gray-500" data-testid="live-status">
                Live: {status}
                {lastSyncedAt && <> · synced {lastSyncedAt.toLocaleTimeString()}</>}
            </p>

            <h1 className="mt-2 text-3xl font-semibold" data-testid="title">
                {document.title}
            </h1>

            {/* Pause live reloads while editing so an incoming change cannot interrupt typing. */}
            <form
                className="mt-4 flex gap-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    rename.put(`/react/documents/${document.uuid}`);
                }}
            >
                <input
                    value={rename.data.title}
                    onChange={(event) => rename.setData('title', event.target.value)}
                    onFocus={pause}
                    onBlur={resume}
                    className="flex-1 rounded border px-3 py-2"
                />
                <button className="rounded bg-black px-4 py-2 text-white" disabled={rename.processing}>
                    Rename
                </button>
            </form>

            <h2 className="mt-10 text-lg font-medium">Comments</h2>

            <form
                className="mt-2 flex gap-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    comment.post(`/react/documents/${document.uuid}/comments`, {
                        preserveScroll: true,
                        onSuccess: () => comment.reset(),
                    });
                }}
            >
                <input
                    value={comment.data.body}
                    onChange={(event) => comment.setData('body', event.target.value)}
                    onFocus={pause}
                    onBlur={resume}
                    className="flex-1 rounded border px-3 py-2"
                    placeholder="Add a comment"
                />
                <button className="rounded bg-black px-4 py-2 text-white" disabled={comment.processing}>
                    Post
                </button>
            </form>

            <ul className="mt-4 space-y-2" data-testid="comments">
                {comments.map((item) => (
                    <li key={item.id} className="rounded border px-3 py-2">
                        {item.body}
                    </li>
                ))}
            </ul>
        </main>
    );
}
