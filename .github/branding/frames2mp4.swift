import Foundation
import AVFoundation
import AppKit

let dir = CommandLine.arguments[1]
let out = URL(fileURLWithPath: CommandLine.arguments[2])
let fps: Int32 = Int32(CommandLine.arguments.count > 3 ? Int(CommandLine.arguments[3])! : 7)

let files = try! FileManager.default.contentsOfDirectory(atPath: dir)
    .filter { $0.hasSuffix(".png") }.sorted()
guard let first = NSImage(contentsOfFile: "\(dir)/\(files[0])") else { exit(1) }
let w = Int(first.size.width), h = Int(first.size.height)

try? FileManager.default.removeItem(at: out)
let writer = try! AVAssetWriter(outputURL: out, fileType: .mp4)
let settings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: w, AVVideoHeightKey: h,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 2_400_000,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    ],
]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input,
    sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32ARGB),
        kCVPixelBufferWidthKey as String: w, kCVPixelBufferHeightKey as String: h])
writer.add(input)
writer.startWriting()
writer.startSession(atSourceTime: .zero)

func buffer(_ path: String) -> CVPixelBuffer? {
    guard let img = NSImage(contentsOfFile: path),
          let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return nil }
    var pb: CVPixelBuffer?
    CVPixelBufferCreate(kCFAllocatorDefault, w, h, kCVPixelFormatType_32ARGB, nil, &pb)
    guard let b = pb else { return nil }
    CVPixelBufferLockBaseAddress(b, [])
    let ctx = CGContext(data: CVPixelBufferGetBaseAddress(b), width: w, height: h,
        bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(b),
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)
    ctx?.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
    CVPixelBufferUnlockBaseAddress(b, [])
    return b
}

for (i, f) in files.enumerated() {
    while !input.isReadyForMoreMediaData { usleep(5000) }
    if let b = buffer("\(dir)/\(f)") {
        adaptor.append(b, withPresentationTime: CMTime(value: CMTimeValue(i), timescale: fps))
    }
}
input.markAsFinished()
let sem = DispatchSemaphore(value: 0)
writer.finishWriting { sem.signal() }
sem.wait()
print("프레임 \(files.count) · \(w)x\(h) · \(fps)fps · \(Double(files.count)/Double(fps)) 초")
if writer.status != .completed { print("실패: \(String(describing: writer.error))"); exit(1) }
