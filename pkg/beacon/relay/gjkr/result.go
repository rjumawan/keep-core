package gjkr

import (
	"math/big"

	bn256 "github.com/ethereum/go-ethereum/crypto/bn256/cloudflare"
	"github.com/keep-network/keep-core/pkg/beacon/relay/group"
)

// Result of distributed key generation protocol.
type Result struct {
	// Group represents the group state, including members, disqualified,
	// and inactive members.
	Group *group.Group
	// Group public key generated by protocol execution.
	GroupPublicKey *bn256.G2
	// Share of the group private key. It is used for signing and should never
	// be revealed publicly.
	GroupPrivateKeyShare *big.Int
}

// Equals checks if two results are equal.
// TODO: Check if we still need this function. If not remove.
func (r *Result) Equals(r2 *Result) bool {
	if r == nil || r2 == nil {
		return r == r2
	}

	if !publicKeysEqual(r.GroupPublicKey, r2.GroupPublicKey) {
		return false
	}

	if r.Group == nil || r2.Group == nil {
		return r.Group == r2.Group
	}

	if !memberIDSlicesEqual(
		r.Group.DisqualifiedMemberIDs(), r2.Group.DisqualifiedMemberIDs(),
	) {
		return false
	}
	if !memberIDSlicesEqual(
		r.Group.InactiveMemberIDs(), r2.Group.InactiveMemberIDs(),
	) {
		return false
	}

	return true
}

// memberIDSlicesEqual checks if two slices of MemberIDs are equal. Slices need
// to have the same length and have the same order of entries.
func memberIDSlicesEqual(expectedSlice []group.MemberIndex, actualSlice []group.MemberIndex) bool {
	if len(expectedSlice) != len(actualSlice) {
		return false
	}

	for i := range expectedSlice {
		if expectedSlice[i] != actualSlice[i] {
			return false
		}
	}
	return true
}
