<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive;

use Freepeace13\InertiaLive\Attributes\LiveTopic;
use InvalidArgumentException;
use ReflectionClass;
use Spatie\EventSourcing\StoredEvents\ShouldBeStored;

final class TopicResolver
{
    /** Valid in Pusher channel names, minus `.` which separates topic segments. */
    private const VALUE_PATTERN = '/^[A-Za-z0-9_\-=@,;]+$/';

    /** @var array<class-string, list<LiveTopic>> */
    private array $attributes = [];

    /**
     * @return list<ResolvedTopic>
     */
    public function forEvent(ShouldBeStored $event): array
    {
        $topics = [];

        foreach ($this->attributesFor($event::class) as $liveTopic) {
            $topics[] = new ResolvedTopic(
                $this->resolveTemplate($liveTopic->template, $event),
                $liveTopic->props,
            );
        }

        return $topics;
    }

    /**
     * Reflection is cached per event class: this runs for every event, replays included.
     *
     * @param  class-string  $class
     * @return list<LiveTopic>
     */
    private function attributesFor(string $class): array
    {
        return $this->attributes[$class] ??= array_map(
            fn ($attribute) => $attribute->newInstance(),
            (new ReflectionClass($class))->getAttributes(LiveTopic::class),
        );
    }

    private function resolveTemplate(string $template, ShouldBeStored $event): string
    {
        return (string) preg_replace_callback('/\{(\w+)\}/', function (array $match) use ($event, $template): string {
            $property = $match[1];

            if (! property_exists($event, $property)) {
                throw new InvalidArgumentException(
                    "Topic template [{$template}] references missing property [{$property}] on ".$event::class.'.'
                );
            }

            $value = $event->{$property};

            if (! is_scalar($value)) {
                throw new InvalidArgumentException(
                    "Topic template [{$template}] property [{$property}] on ".$event::class.' must be a scalar.'
                );
            }

            $value = (string) $value;

            // Dots would never match a `{placeholder}` authorizer segment, so the signal would
            // fail closed forever; other characters are rejected in Pusher channel names.
            if (preg_match(self::VALUE_PATTERN, $value) !== 1) {
                throw new InvalidArgumentException(
                    "Topic template [{$template}] property [{$property}] on ".$event::class
                    ." has value [{$value}], which is not usable in a channel name (letters, digits and _-=@,; only)."
                );
            }

            return $value;
        }, $template);
    }
}
