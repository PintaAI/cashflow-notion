import { NextResponse } from "next/server";
import { registerClient } from "@/lib/oauth/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.client_name || !body.redirect_uris) {
      return NextResponse.json(
        {
          error: "invalid_client_metadata",
          error_description: "client_name and redirect_uris are required",
        },
        { status: 400 },
      );
    }

    if (
      !Array.isArray(body.redirect_uris) ||
      body.redirect_uris.length === 0
    ) {
      return NextResponse.json(
        {
          error: "invalid_client_metadata",
          error_description: "redirect_uris must be a non-empty array",
        },
        { status: 400 },
      );
    }

    for (const uri of body.redirect_uris) {
      if (typeof uri !== "string") {
        return NextResponse.json(
          {
            error: "invalid_client_metadata",
            error_description: "redirect_uris must be an array of strings",
          },
          { status: 400 },
        );
      }
      if (!uri.startsWith("http://") && !uri.startsWith("https://")) {
        return NextResponse.json(
          {
            error: "invalid_client_metadata",
            error_description: `Invalid redirect URI: ${uri}`,
          },
          { status: 400 },
        );
      }
    }

    const client = await registerClient({
      clientName: body.client_name,
      clientUri: body.client_uri,
      logoUri: body.logo_uri,
      redirectUris: body.redirect_uris,
      grantTypes: body.grant_types,
      responseTypes: body.response_types,
      scope: body.scope,
      tokenEndpointAuthMethod: body.token_endpoint_auth_method,
    });

    return NextResponse.json(
      {
        client_id: client.clientId,
        client_secret: client.clientSecret,
        client_name: client.clientName,
        client_uri: client.clientUri,
        logo_uri: client.logoUri,
        redirect_uris: client.redirectUris,
        grant_types: client.grantTypes,
        response_types: client.responseTypes,
        scope: client.scope,
        token_endpoint_auth_method: client.isPublic ? "none" : "client_secret_basic",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      {
        error: "server_error",
        error_description: "Client registration failed",
      },
      { status: 500 },
    );
  }
}
