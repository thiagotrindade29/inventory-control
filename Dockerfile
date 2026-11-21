# Build context: repository root
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY backend-dotnet/InventoryControl.Domain/InventoryControl.Domain.csproj backend-dotnet/InventoryControl.Domain/
COPY backend-dotnet/InventoryControl.Application/InventoryControl.Application.csproj backend-dotnet/InventoryControl.Application/
COPY backend-dotnet/InventoryControl.Infrastructure/InventoryControl.Infrastructure.csproj backend-dotnet/InventoryControl.Infrastructure/
COPY backend-dotnet/InventoryControl.Api/InventoryControl.Api.csproj backend-dotnet/InventoryControl.Api/
COPY database/schema.sql database/schema.sql
RUN dotnet restore backend-dotnet/InventoryControl.Api/InventoryControl.Api.csproj

COPY backend-dotnet/ backend-dotnet/
WORKDIR /src/backend-dotnet/InventoryControl.Api
RUN dotnet publish InventoryControl.Api.csproj -c Release --no-restore -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

# Render supplies PORT; use 8080 when running the image locally.
ENTRYPOINT ["sh", "-c", "dotnet InventoryControl.Api.dll --urls http://0.0.0.0:${PORT:-8080}"]
