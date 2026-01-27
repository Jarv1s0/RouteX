import { motion, Variants } from 'framer-motion'
import React from 'react'

interface Props {
  children: React.ReactNode
}

const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 10,
    scale: 0.98,
    filter: 'blur(4px)'
  },
  enter: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 0.3,
      ease: [0.2, 0, 0, 1] // Custom ease curve for smoothness
    }
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.98,
    filter: 'blur(4px)',
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 1, 1]
    }
  }
}

const PageTransition: React.FC<Props> = ({ children }) => {
  return (
    <motion.div
      initial="initial"
      animate="enter"
      exit="exit"
      variants={pageVariants}
      className="h-full w-full"
    >
      {children}
    </motion.div>
  )
}

export default PageTransition
