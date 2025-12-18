import { motion, Variants } from 'framer-motion'
import React from 'react'

interface Props {
  children: React.ReactNode
}

const pageVariants: Variants = {
  initial: {
    opacity: 0
  },
  enter: {
    opacity: 1,
    transition: {
      duration: 0.15,
      ease: [0.4, 0, 0.2, 1]
    }
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.1,
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
