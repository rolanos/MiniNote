using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using MiniNote.Domain.Entities;

namespace MiniNote.Infrastructure.Persistence.Configurations;

public sealed class TagConfiguration : IEntityTypeConfiguration<Tag>
{
    public void Configure(EntityTypeBuilder<Tag> builder)
    {
        builder.HasKey(tag => tag.Id);
        builder.Property(tag => tag.Id).ValueGeneratedNever();
        builder.Property(tag => tag.Name).HasMaxLength(Tag.MaxNameLength).IsRequired();
        builder.Property(tag => tag.NormalizedName).HasMaxLength(Tag.MaxNameLength).IsRequired();
        builder.HasIndex(tag => tag.NormalizedName).IsUnique();
    }
}
