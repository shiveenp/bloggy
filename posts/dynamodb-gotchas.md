---
title: Dynamodb Gotchas
date: 2021-05-19T19:56:29+10:00
---

This is just a collection of things that required some google searches to resolve while working with DynamoDB at work recently. All the code examples here use Kotlin, though, I'm confident that they would still appear in Java.

## Persisting a DynamoDb Object that extends a class

DynamoDB doesn't automatically work with Abstract classes. For example, let's say you have an `abstract class` which contains some common fields (such as the hashKey and the range fields),

```kotlin
abstract class AbstractBook @JvmOverloads constructor(
    @DynamoDBHashKey(attributeName = "isbn")
    var isbn: String? = null,

    @DynamoDBTyped(DynamoDBMapperFieldModel.DynamoDBAttributeType.S)
    @DynamoDBRangeKey(attributeName = "author")
    var bookType: String? = null
)
```

And then you define the actual class, that extends this base class,

```kotlin
class Novella @JvmOverloads constructor(
		isbn: String? = null,
		bookType: String? = null, 
        var content: String? = null
 ) : AbstractBook (isbn, bookType)
```

When you try to use a `DynamoDBMapper` to save the object it will throw an exception.

To fix the exception, you'll need to add the `@DynamoDBDocument` to the AbstractClass to let the mapper know that it's the abstract version of the actual persisted entity. This is what the JavaDoc for the annotation says:

> An annotation that marks a class which can be serialised to a DynamoDB document or sub-document. Behaves exactly the same as DynamoDBTable, but without requiring you to specify a tableName.

Which means that this annotation is necessary to serialise objects types that are not directly part of the actual stored object type.

## Persisting a List of Objects in DynamoDB

Another little snowflake behaviour I encountered was when persisting a list of objects. Let's say we go ahead and add some more data to the Novella object, like a List of Publishers.

```kotlin
data class Publishers(
    val name: String,
    val address: String?
)
```

```kotlin
class Novella @JvmOverloads constructor(
		isbn: String? = null,
		bookType: String? = null,
        var content: String? = null, 
        @DynamoDBTypeConvertedJson 
        val publishers: List<Publishers>? = null
 ) : AbstractBook (isbn, bookType)
```

`@DynamoDBTypeConvertedJson` is the annotation DynamoDB recommends for storing objects when using DynamoDBMapper. It has a strange behaviour where it can auto serialise a `List<T>` but it loses type information on deserialisation and deserialises the object as an amorphous map. Which means you get exceptions like:
`java.lang.ClassCastException: java.util.LinkedHashMap cannot be cast to Publisher`.

Based on this [thread](https://stackoverflow.com/questions/30793481/dynamodb-jsonmarshaller-cannot-deserialize-list-of-object) this has to do with type erasure, wherein `T : Object` which results in bad behaviour at deserialisation time (the default Jackson marshaller is smart enough during serialisation).

The best way to solve this is to define a custom serialiser and deserialiser for your object.

So, in this case it's a matter of defining a class like,

```kotlin
class PublishersMapListConverter : DynamoDBTypeConverter<String, List<Publishers>> {
    private val objectMapper = jacksonObjectMapper()

    override fun convert(publishers: List<Publishers>): String {
        return objectMapper.writeValueAsString(publishers)
    }

    override fun unconvert(publishers: String): List<Publishers> {
        val type = object : TypeReference<List<Publishers>>() {}
        return objectMapper.readValue(publishers, type)
    }
}
```

And then adding the `@DynamoDBTypeConverted(converter = PublishersMapListConverter::class)`,

```kotlin
class Novella @JvmOverloads constructor(
        isbn: String? = null,
        bookType: String? = null,
        var content: String? = null,
        @DynamoDBTypeConverted(converter = PublishersMapListConverter::class)
        val publishers: List<Publishers>? = null
) : AbstractBook(isbn, bookType)
```

Hopefully this post helps someone else save some time as well.
