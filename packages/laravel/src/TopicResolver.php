<?php

declare(strict_types=1);

namespace Freepeace13\InertiaLive;

use Freepeace13\InertiaLive\Attributes\LiveTopic;
use InvalidArgumentException;
use ReflectionClass;
use Spatie\EventSourcing\StoredEvents\ShouldBeStored;

final class TopicResolver
{
    /**
     * @return list<ResolvedTopic>
     */
    public function forEvent(ShouldBeStored $event): array
    {
        $attributes = (new ReflectionClass($event))->getAttributes(LiveTopic::class);

        $topics = [];

        foreach ($attributes as $attribute) {
            $liveTopic = $attribute->newInstance();

            $topics[] = new ResolvedTopic(
                $this->resolveTemplate($liveTopic->template, $event),
                $liveTopic->props,
                $liveTopic->public,
            );
        }

        return $topics;
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

            return (string) $value;
        }, $template);
    }
}
