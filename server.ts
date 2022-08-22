import { createServer } from "@graphql-yoga/node";
import { useLiveQuery } from "@envelop/live-query";
import { InMemoryLiveQueryStore } from "@n1ru4l/in-memory-live-query-store";
import { GraphQLLiveDirective } from "@n1ru4l/graphql-live-query";
import { astFromDirective } from "@graphql-tools/utils";
import { applyLiveQueryJSONDiffPatchGenerator } from "@n1ru4l/graphql-live-query-patch-jsondiffpatch";

const liveQueryStore = new InMemoryLiveQueryStore();

type Bid = {
  id: number
  amount: number;
};

type Auction = {
  id: string;
  title: string;
  bids: Bid[];
};

let lastBidId = 1

const auctions: Auction[] = [
  { id: "1", title: "Digital-only PS5", bids: [{ id: lastBidId, amount: 100 }] },
];

const server = createServer({
  schema: {
    typeDefs: [
      /* GraphQL */ `
        type Query {
          auction(id: ID!): Auction
        }
        type Auction {
          id: ID!
          title: String!
          highestBid: Bid
          bids: [Bid!]!
        }
        type Bid {
          id: ID!
          amount: Int!
        }
        type Mutation {
          bid(input: BidInput!): Bid
        }
        input BidInput {
          auctionId: ID!
          amount: Int!
        }
      `,
      astFromDirective(GraphQLLiveDirective),
    ],
    resolvers: {
      Query: {
        auction: (_, { id }) => auctions.find((a) => a.id === id),
      },
      Mutation: {
        bid: async (_, { input }) => {
          const { auctionId, amount } = input;

          const index = auctions.findIndex((a) => a.id === auctionId);
          lastBidId++
          const bid = { id: lastBidId, amount };

          auctions[index].bids.push(bid);

          liveQueryStore.invalidate(`Auction:${auctionId}`);

          return bid;
        },
      },
      Auction: {
        highestBid: ({ bids }: Auction) => {
          const [max] = bids.sort((a, b) => b.amount - a.amount);

          return max;
        },
      },
    },
  },
  plugins: [
    useLiveQuery({
      liveQueryStore,
      applyLiveQueryPatchGenerator: applyLiveQueryJSONDiffPatchGenerator,
    }),
  ],
});

server.start();
